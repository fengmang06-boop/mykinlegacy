import { ulid } from "ulid";

import { prisma as defaultPrisma } from "../client";
import { Prisma, type PrismaClient } from "../../generated/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface RepositoryHouseDNA {
  contract_version: string;
  schema_version: string;
  source: string;
  privacy_preferences: unknown;
  [key: string]: unknown;
}

export interface RepositoryIdentityMemory {
  house_id: string;
  identity_version_id: string | null;
  [key: string]: unknown;
}

const createId = () => ulid();
const now = () => new Date();

export interface CreateInterviewRecordInput {
  houseId?: string | null;
  currentStep: string;
  locale?: string;
  expiresAt: Date;
  answers?: Prisma.InputJsonValue;
  houseDnaDraft?: Prisma.InputJsonValue | null;
  normalizedInput?: Prisma.InputJsonValue | null;
}

export async function createInterviewRecord(
  input: CreateInterviewRecordInput,
  client: DatabaseClient = defaultPrisma
) {
  const timestamp = now();

  return client.houseInterview.create({
    data: {
      id: createId(),
      houseId: input.houseId ?? null,
      status: "in_progress",
      currentStep: input.currentStep,
      locale: input.locale ?? "en-US",
      expiresAt: input.expiresAt,
      answersJson: input.answers ?? [],
      houseDnaDraftJson: nullableJson(input.houseDnaDraft),
      normalizedInputJson: nullableJson(input.normalizedInput),
      createdAt: timestamp,
      updatedAt: timestamp
    }
  });
}

export async function updateInterviewAnswer(
  interviewId: string,
  answer: Prisma.InputJsonValue,
  client: DatabaseClient = defaultPrisma
) {
  const interview = await client.houseInterview.findUniqueOrThrow({
    where: { id: interviewId }
  });
  const existingAnswers = Array.isArray(interview.answersJson) ? interview.answersJson : [];

  return client.houseInterview.update({
    where: { id: interviewId },
    data: {
      answersJson: [...existingAnswers, answer] as Prisma.InputJsonValue,
      updatedAt: now()
    }
  });
}

export interface CreateHouseWithIdentityDraftInput {
  displayName: string;
  defaultLocale?: string;
  ownerUserId?: string | null;
  primaryCustomerProfileId?: string | null;
  houseDnaDraft?: RepositoryHouseDNA | null;
  privacyPreferences?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

export async function createHouseWithIdentityDraft(
  input: CreateHouseWithIdentityDraftInput,
  client: PrismaClient = defaultPrisma
) {
  return client.$transaction(async (transaction) => {
    const timestamp = now();
    const house = await transaction.house.create({
      data: {
        id: createId(),
        status: "active",
        ownerUserId: input.ownerUserId ?? null,
        primaryCustomerProfileId: input.primaryCustomerProfileId ?? null,
        displayName: input.displayName,
        defaultLocale: input.defaultLocale ?? "en-US",
        metadataJson: nullableJson(input.metadata),
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    const identity = await transaction.houseIdentity.create({
      data: {
        id: createId(),
        houseId: house.id,
        status: "draft",
        currentHouseDnaJson: nullableJson(input.houseDnaDraft),
        privacyPreferencesJson: nullableJson(input.privacyPreferences),
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    return { house, identity };
  });
}

export async function confirmHouseIdentity(
  identityId: string,
  houseDna: RepositoryHouseDNA,
  client: DatabaseClient = defaultPrisma
) {
  return client.houseIdentity.update({
    where: { id: identityId },
    data: {
      status: "confirmed",
      currentHouseDnaJson: nullableJson(houseDna),
      privacyPreferencesJson: nullableJson(houseDna.privacy_preferences),
      updatedAt: now()
    }
  });
}

export interface CreateIdentityVersionV1Input {
  houseId: string;
  identityId: string;
  houseDna: RepositoryHouseDNA;
  generatedFromOrderId?: string | null;
  generatedFromInterviewId?: string | null;
  generatedFromAdminEdit?: boolean;
}

export async function createIdentityVersionV1(
  input: CreateIdentityVersionV1Input,
  client: PrismaClient = defaultPrisma
) {
  return client.$transaction(async (transaction) => {
    const timestamp = now();
    await transaction.houseIdentityVersion.updateMany({
      where: { identityId: input.identityId, activeVersion: true },
      data: { activeVersion: false }
    });

    const version = await transaction.houseIdentityVersion.create({
      data: {
        id: createId(),
        houseId: input.houseId,
        identityId: input.identityId,
        identityVersion: 1,
        versionReason: "initial_create",
        previousVersionId: null,
        activeVersion: true,
        generatedFromOrderId: input.generatedFromOrderId ?? null,
        generatedFromInterviewId: input.generatedFromInterviewId ?? null,
        generatedFromAdminEdit: input.generatedFromAdminEdit ?? false,
        houseDnaSnapshotJson: json(input.houseDna),
        changedFieldsJson: [],
        contractVersion: input.houseDna.contract_version,
        schemaVersion: input.houseDna.schema_version,
        source: input.houseDna.source,
        createdAt: timestamp
      }
    });

    await transaction.houseIdentity.update({
      where: { id: input.identityId },
      data: {
        activeVersionId: version.id,
        status: "confirmed",
        currentHouseDnaJson: json(input.houseDna),
        privacyPreferencesJson: json(input.houseDna.privacy_preferences),
        updatedAt: timestamp
      }
    });

    return version;
  });
}

export async function getHouseIdentityById(identityId: string, client: DatabaseClient = defaultPrisma) {
  return client.houseIdentity.findUnique({
    where: { id: identityId },
    include: {
      house: true,
      activeVersion: true
    }
  });
}

export async function getIdentityVersionById(versionId: string, client: DatabaseClient = defaultPrisma) {
  return client.houseIdentityVersion.findUnique({
    where: { id: versionId }
  });
}

export async function upsertIdentityMemory(
  memory: RepositoryIdentityMemory,
  client: DatabaseClient = defaultPrisma
) {
  const timestamp = now();
  const existing = await client.houseIdentityMemory.findFirst({
    where: {
      houseId: memory.house_id,
      identityVersionId: memory.identity_version_id
    },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return client.houseIdentityMemory.update({
      where: { id: existing.id },
      data: {
        memoryJson: json(memory),
        updatedAt: timestamp
      }
    });
  }

  return client.houseIdentityMemory.create({
    data: {
      id: createId(),
      houseId: memory.house_id,
      identityVersionId: memory.identity_version_id,
      memoryJson: json(memory),
      createdAt: timestamp,
      updatedAt: timestamp
    }
  });
}

export interface CreateConsentRecordInput {
  houseId?: string | null;
  orderId?: string | null;
  termsAccepted: boolean;
  termsAcceptedAt?: Date | null;
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedAt?: Date | null;
  heritageDisclaimerAccepted: boolean;
  heritageDisclaimerAcceptedAt?: Date | null;
  aiGenerationConsent: boolean;
  emailDeliveryConsent: boolean;
  marketingOptIn?: boolean;
  galleryOptIn?: boolean;
  ipHash?: string | null;
  userAgentHash?: string | null;
  consentVersion: string;
  contractVersion?: string;
  schemaVersion?: string;
  source?: string;
}

export async function createConsentRecord(
  input: CreateConsentRecordInput,
  client: DatabaseClient = defaultPrisma
) {
  const timestamp = now();

  return client.consentRecord.create({
    data: {
      id: createId(),
      houseId: input.houseId ?? null,
      orderId: input.orderId ?? null,
      termsAccepted: input.termsAccepted,
      termsAcceptedAt: input.termsAcceptedAt ?? null,
      privacyPolicyAccepted: input.privacyPolicyAccepted,
      privacyPolicyAcceptedAt: input.privacyPolicyAcceptedAt ?? null,
      heritageDisclaimerAccepted: input.heritageDisclaimerAccepted,
      heritageDisclaimerAcceptedAt: input.heritageDisclaimerAcceptedAt ?? null,
      aiGenerationConsent: input.aiGenerationConsent,
      emailDeliveryConsent: input.emailDeliveryConsent,
      marketingOptIn: input.marketingOptIn ?? false,
      galleryOptIn: input.galleryOptIn ?? false,
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
      consentVersion: input.consentVersion,
      contractVersion: input.contractVersion ?? "1.1",
      schemaVersion: input.schemaVersion ?? "consent_record.v1",
      source: input.source ?? "repository",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  });
}

export async function checkConsentAllowsGeneration(
  input: { houseId?: string | null; orderId?: string | null },
  client: DatabaseClient = defaultPrisma
): Promise<boolean> {
  const consent = await client.consentRecord.findFirst({
    where: {
      houseId: input.houseId ?? undefined,
      orderId: input.orderId ?? undefined
    },
    orderBy: { createdAt: "desc" }
  });

  return Boolean(
    consent?.termsAccepted &&
      consent.privacyPolicyAccepted &&
      consent.heritageDisclaimerAccepted &&
      consent.aiGenerationConsent &&
      consent.emailDeliveryConsent
  );
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function nullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null ? Prisma.JsonNull : json(value);
}
