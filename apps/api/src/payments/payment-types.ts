export interface PaymentOrderRecord {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: bigint | number;
  currency: string;
  paidAt?: Date | null;
  metadataJson: unknown;
  orderItems: Array<{
    id: string;
    productSnapshotJson: unknown;
    product: {
      code: string;
      translations: Array<{ locale: string; name: string }>;
    };
    package: {
      code: string;
    };
  }>;
  consentRecords: Array<{
    termsAccepted: boolean;
    privacyPolicyAccepted: boolean;
    heritageDisclaimerAccepted: boolean;
    aiGenerationConsent: boolean;
    emailDeliveryConsent: boolean;
  }>;
}

export interface PaymentIntentRecord {
  id: string;
  providerIntentId: string;
}

export interface WebhookRecord {
  id: string;
  providerEventId: string;
  processingStatus: string;
}
