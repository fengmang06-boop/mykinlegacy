import { HttpStatus, Injectable } from "@nestjs/common";
import { ulid } from "ulid";

import { ApiException } from "./api-error";
import { sha256, stableJson } from "./security";

type IdempotencyClient = {
  idempotencyKey: {
    findUnique: (args: unknown) => Promise<IdempotencyRecord | null>;
    create: (args: unknown) => Promise<IdempotencyRecord>;
    update: (args: unknown) => Promise<IdempotencyRecord>;
  };
};

interface IdempotencyRecord {
  id: string;
  requestHash: string;
  responseJson: unknown;
  status: string;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: IdempotencyClient) {}

  async run<T>(input: {
    idempotencyKey: string | undefined;
    scope?: "api";
    requestBody: unknown;
    handler: () => Promise<T>;
  }): Promise<T> {
    if (!input.idempotencyKey) {
      throw new ApiException({
        errorCode: "validation_error",
        message: "Idempotency-Key header is required for mutation endpoints.",
        userMessage: "Please retry with an Idempotency-Key header.",
        status: HttpStatus.BAD_REQUEST,
        affectedField: "Idempotency-Key"
      });
    }

    const requestHash = sha256(stableJson(input.requestBody));
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        scope_idempotencyKey: {
          scope: input.scope ?? "api",
          idempotencyKey: input.idempotencyKey
        }
      }
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ApiException({
          errorCode: "idempotency_conflict",
          message: "Idempotency-Key was reused with a different request payload.",
          userMessage: "This request key was already used for different data.",
          status: HttpStatus.CONFLICT,
          affectedField: "Idempotency-Key"
        });
      }
      return existing.responseJson as T;
    }

    const timestamp = new Date();
    const expiresAt = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
    const record = await this.prisma.idempotencyKey.create({
      data: {
        id: ulid(),
        scope: input.scope ?? "api",
        idempotencyKey: input.idempotencyKey,
        requestHash,
        status: "processing",
        expiresAt,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    const response = await input.handler();
    await this.prisma.idempotencyKey.update({
      where: { id: record.id },
      data: {
        responseJson: response,
        status: "completed",
        updatedAt: new Date()
      }
    });

    return response;
  }
}
