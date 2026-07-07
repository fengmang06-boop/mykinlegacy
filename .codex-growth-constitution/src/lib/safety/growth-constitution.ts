export const GROWTH_CONSTITUTION_VERSION = "1.0";

export const growthConstitutionDefaults = {
  readOnly: true,
  manualApprovalRequired: true,
  versionHistoryRequired: true,
  rollbackSupportRequired: true,
  evidenceRequired: true,
  riskAssessmentRequired: true,
  etsyAutoWriteAllowed: false,
  customerMessagingAllowed: false,
  reviewReplyAutomationAllowed: false,
  competitorScrapingAllowed: false
} as const;

export const growthRecommendationRequiredFields = [
  "evidence",
  "riskLevel",
  "expectedBenefit",
  "rollbackPlan",
  "manualApprovalStatus",
  "versionHistoryReference"
] as const;

export function createGrowthComplianceChecklist(scope: string) {
  return {
    constitutionVersion: GROWTH_CONSTITUTION_VERSION,
    scope,
    ...growthConstitutionDefaults
  };
}
