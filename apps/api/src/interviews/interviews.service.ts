import { HttpStatus, Injectable } from "@nestjs/common";
import { ulid } from "ulid";

import { ApiException } from "../common/api-error";
import { isRecord, requireDataEnvelope, requireString } from "../common/validation";
import { PrismaService } from "../database/prisma.service";
import {
  buildHouseDNA,
  mergeHouseDnaDraft,
  nextInterviewStep,
  normalizeTextInput,
  validateHouseDNA,
  type HouseDNA
} from "../house-identity-core";

type InterviewClient = {
  houseInterview: {
    create: (args: unknown) => Promise<InterviewRecord>;
    findUnique: (args: unknown) => Promise<InterviewRecord | null>;
    update: (args: unknown) => Promise<InterviewRecord>;
  };
  house: { create: (args: unknown) => Promise<{ id: string }> };
  houseIdentity: {
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<unknown>;
  };
  houseIdentityVersion: {
    updateMany: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<{ id: string; identityVersion: number; activeVersion: boolean }>;
  };
  $transaction: <T>(fn: (client: InterviewClient) => Promise<T>) => Promise<T>;
};

interface InterviewRecord {
  id: string;
  houseId: string | null;
  status: string;
  currentStep: string;
  locale: string;
  expiresAt: Date;
  answersJson: unknown;
  houseDnaDraftJson: unknown;
  normalizedInputJson: unknown;
}

@Injectable()
export class InterviewsService {
  private readonly prisma: InterviewClient;

  constructor(prismaService: PrismaService) {
    this.prisma = prismaService.db as unknown as InterviewClient;
  }

  async createInterview(body: unknown) {
    const data = requireDataEnvelope(body);
    const locale = typeof data.locale === "string" ? data.locale : "en-US";
    const timestamp = new Date();
    const expiresAt = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
    const interview = await this.prisma.houseInterview.create({
      data: {
        id: ulid(),
        houseId: null,
        status: "in_progress",
        currentStep: "name_your_house",
        locale,
        expiresAt,
        answersJson: [],
        houseDnaDraftJson: null,
        normalizedInputJson: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    return {
      interview_id: interview.id,
      current_step: interview.currentStep,
      expires_at: interview.expiresAt.toISOString()
    };
  }

  async getInterview(interviewId: string) {
    const interview = await this.findInterview(interviewId);
    return {
      interview_id: interview.id,
      status: interview.status,
      current_step: interview.currentStep,
      answers_completed: Array.isArray(interview.answersJson) ? interview.answersJson.length : 0,
      house_dna_draft: interview.houseDnaDraftJson,
      expires_at: interview.expiresAt.toISOString()
    };
  }

  async submitAnswer(interviewId: string, body: unknown) {
    const interview = await this.findActiveInterview(interviewId);
    const data = requireDataEnvelope(body);
    const stepCode = requireString(data, "step_code");
    const rawAnswer = data.raw_answer;
    if (rawAnswer === undefined || rawAnswer === null) {
      throwValidation("raw_answer is required.", "raw_answer");
    }

    const freeText = extractAnswerText(rawAnswer);
    const normalized = normalizeTextInput(freeText);
    const draft = mergeHouseDnaDraft(
      interview.houseDnaDraftJson,
      normalized.normalized_house_dna as Partial<HouseDNA>
    );
    const nextStep = nextInterviewStep(interview.currentStep);
    const answers = Array.isArray(interview.answersJson) ? interview.answersJson : [];
    const answerContract = {
      contract_version: "1.1",
      schema_version: "interview_answer.v1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: "api",
      step_code: stepCode,
      raw_answer: rawAnswer,
      normalized_output: normalized.normalized_house_dna,
      maps_to_house_dna: normalized.inferred_fields
    };

    await this.prisma.houseInterview.update({
      where: { id: interviewId },
      data: {
        currentStep: nextStep,
        answersJson: [...answers, answerContract],
        houseDnaDraftJson: draft,
        normalizedInputJson: normalized,
        updatedAt: new Date()
      }
    });

    return {
      interview_id: interviewId,
      current_step: nextStep,
      next_step: nextStep,
      normalized_output: normalized.normalized_house_dna,
      house_dna_draft: draft
    };
  }

  async normalizeInput(interviewId: string, body: unknown) {
    await this.findActiveInterview(interviewId);
    const data = requireDataEnvelope(body);
    const rawInput = requireString(data, "raw_input");
    const normalized = normalizeTextInput(rawInput);

    await this.prisma.houseInterview.update({
      where: { id: interviewId },
      data: {
        normalizedInputJson: normalized,
        updatedAt: new Date()
      }
    });

    return normalized;
  }

  async confirm(interviewId: string, body: unknown) {
    const interview = await this.findActiveInterview(interviewId);
    const data = requireDataEnvelope(body);
    const inputHouseDna = isRecord(data.house_dna)
      ? buildHouseDNA(data.house_dna as Partial<HouseDNA>)
      : buildHouseDNA(interview.houseDnaDraftJson as Partial<HouseDNA>);
    validateHouseDNA(inputHouseDna);

    return this.prisma.$transaction(async (transaction) => {
      const timestamp = new Date();
      const house =
        interview.houseId !== null
          ? { id: interview.houseId }
          : await transaction.house.create({
              data: {
                id: ulid(),
                status: "active",
                ownerUserId: null,
                primaryCustomerProfileId: null,
                displayName: inputHouseDna.house_name,
                defaultLocale: inputHouseDna.locale,
                metadataJson: null,
                createdAt: timestamp,
                updatedAt: timestamp
              }
            });

      const identity = await transaction.houseIdentity.create({
        data: {
          id: ulid(),
          houseId: house.id,
          status: "confirmed",
          currentHouseDnaJson: inputHouseDna,
          privacyPreferencesJson: inputHouseDna.privacy_preferences,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      });

      await transaction.houseIdentityVersion.updateMany({
        where: { identityId: identity.id, activeVersion: true },
        data: { activeVersion: false }
      });

      const version = await transaction.houseIdentityVersion.create({
        data: {
          id: ulid(),
          houseId: house.id,
          identityId: identity.id,
          identityVersion: 1,
          versionReason: "initial_create",
          previousVersionId: null,
          activeVersion: true,
          generatedFromOrderId: null,
          generatedFromInterviewId: interview.id,
          generatedFromAdminEdit: false,
          houseDnaSnapshotJson: inputHouseDna,
          changedFieldsJson: [],
          contractVersion: inputHouseDna.contract_version,
          schemaVersion: inputHouseDna.schema_version,
          source: inputHouseDna.source,
          createdAt: timestamp
        }
      });

      await transaction.houseIdentity.update({
        where: { id: identity.id },
        data: { activeVersionId: version.id, updatedAt: timestamp }
      });
      await transaction.houseInterview.update({
        where: { id: interviewId },
        data: {
          houseId: house.id,
          status: "confirmed",
          houseDnaDraftJson: inputHouseDna,
          updatedAt: timestamp
        }
      });

      return {
        house_id: house.id,
        identity_id: identity.id,
        identity_version_id: version.id,
        identity_version: version.identityVersion,
        active_version: version.activeVersion,
        status: "confirmed"
      };
    });
  }

  private async findInterview(interviewId: string): Promise<InterviewRecord> {
    const interview = await this.prisma.houseInterview.findUnique({
      where: { id: interviewId }
    });
    if (!interview) {
      throw new ApiException({
        errorCode: "interview_not_found",
        message: `Interview not found: ${interviewId}`,
        userMessage: "The interview could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "interview_id"
      });
    }
    return interview;
  }

  private async findActiveInterview(interviewId: string): Promise<InterviewRecord> {
    const interview = await this.findInterview(interviewId);
    if (interview.expiresAt.getTime() < Date.now()) {
      throw new ApiException({
        errorCode: "interview_expired",
        message: `Interview expired: ${interviewId}`,
        userMessage: "This interview has expired. Please start again.",
        status: HttpStatus.GONE,
        affectedField: "interview_id"
      });
    }
    return interview;
  }
}

function extractAnswerText(rawAnswer: unknown): string {
  if (typeof rawAnswer === "string") {
    return rawAnswer;
  }
  if (isRecord(rawAnswer)) {
    const selected = Array.isArray(rawAnswer.selected_options)
      ? rawAnswer.selected_options.join(" ")
      : "";
    const freeText = typeof rawAnswer.free_text === "string" ? rawAnswer.free_text : "";
    return `${selected} ${freeText}`.trim();
  }
  return String(rawAnswer);
}

function throwValidation(message: string, affectedField: string): never {
  throw new ApiException({
    errorCode: "validation_error",
    message,
    userMessage: "Please check the submitted answer.",
    affectedField
  });
}
