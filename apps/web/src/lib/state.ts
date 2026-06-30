export type InterviewState =
  | "not_started"
  | "in_progress"
  | "normalizing"
  | "needs_confirmation"
  | "confirmed"
  | "expired";

export type OrderState =
  | "not_created"
  | "draft"
  | "pending_payment"
  | "paid"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type PaymentUiState =
  | "not_started"
  | "checkout_creating"
  | "redirecting_to_stripe"
  | "returned_from_stripe"
  | "verifying_payment"
  | "payment_confirmed"
  | "payment_cancelled"
  | "payment_failed";

export type GenerationUiState =
  | "not_started"
  | "queued"
  | "generating"
  | "partially_completed"
  | "completed"
  | "failed"
  | "delayed";

export type DownloadState =
  | "token_loading"
  | "token_active"
  | "token_expired"
  | "token_revoked"
  | "assets_ready"
  | "assets_not_ready"
  | "signed_url_creating"
  | "download_started"
  | "download_failed";

export function friendlyGenerationMessage(input: {
  payment_status?: string;
  fulfillment_status?: string;
  download_ready?: boolean;
  elapsed_minutes?: number;
}): string {
  if (input.download_ready || input.fulfillment_status === "completed") {
    return "Your download vault is ready.";
  }
  if (input.fulfillment_status === "failed") {
    return "We need to review your order. Please contact support.";
  }
  if ((input.elapsed_minutes ?? 0) > 30) {
    return "Your collection is taking longer than expected. Support can help check the status.";
  }
  if (input.payment_status === "paid") {
    return "Your House Identity is being forged.";
  }
  return "We are waiting for payment confirmation.";
}
