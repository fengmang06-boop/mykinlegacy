import { describe, expect, it } from "vitest";

import { ApiException } from "./api-error";
import { createErrorContract } from "./api-error";
import { IdempotencyService } from "./idempotency.service";

describe("IdempotencyService", () => {
  it("returns same response for same key and payload", async () => {
    const prisma = createIdempotencyPrismaMock();
    const service = new IdempotencyService(prisma);
    const first = await service.run({
      idempotencyKey: "same-key",
      requestBody: { data: { value: 1 } },
      handler: async () => ({ ok: true })
    });
    const second = await service.run({
      idempotencyKey: "same-key",
      requestBody: { data: { value: 1 } },
      handler: async () => ({ ok: false })
    });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
  });

  it("rejects same key with different payload", async () => {
    const prisma = createIdempotencyPrismaMock();
    const service = new IdempotencyService(prisma);
    await service.run({
      idempotencyKey: "conflict-key",
      requestBody: { data: { value: 1 } },
      handler: async () => ({ ok: true })
    });

    await expect(
      service.run({
        idempotencyKey: "conflict-key",
        requestBody: { data: { value: 2 } },
        handler: async () => ({ ok: false })
      })
    ).rejects.toBeInstanceOf(ApiException);
  });

  it("creates ErrorContract v1.1", () => {
    const contract = createErrorContract(
      new ApiException({
        errorCode: "validation_error",
        message: "Internal developer message.",
        userMessage: "Friendly user-facing message."
      })
    );

    expect(contract.contract_version).toBe("1.1");
    expect(contract.error_code).toBe("validation_error");
  });
});

function createIdempotencyPrismaMock() {
  const records = new Map<string, { id: string; requestHash: string; responseJson: unknown; status: string }>();

  return {
    idempotencyKey: {
      findUnique: async (args: unknown) => {
        const typedArgs = args as { where: { scope_idempotencyKey: { idempotencyKey: string } } };
        return records.get(typedArgs.where.scope_idempotencyKey.idempotencyKey) ?? null;
      },
      create: async (args: unknown) => {
        const typedArgs = args as {
          data: { id: string; idempotencyKey: string; requestHash: string; responseJson?: unknown; status: string };
        };
        const record = {
          id: typedArgs.data.id,
          requestHash: typedArgs.data.requestHash,
          responseJson: typedArgs.data.responseJson,
          status: typedArgs.data.status
        };
        records.set(typedArgs.data.idempotencyKey, record);
        return record;
      },
      update: async (args: unknown) => {
        const typedArgs = args as { where: { id: string }; data: { responseJson: unknown; status: string } };
        const record = [...records.values()].find((item) => item.id === typedArgs.where.id);
        if (!record) {
          throw new Error("Missing idempotency record");
        }
        record.responseJson = typedArgs.data.responseJson;
        record.status = typedArgs.data.status;
        return record;
      }
    }
  };
}
