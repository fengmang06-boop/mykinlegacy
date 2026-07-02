import { HttpException, HttpStatus } from "@nestjs/common";

export type ApiErrorCode =
  | "validation_error"
  | "normalization_error"
  | "consent_required"
  | "order_not_found"
  | "product_not_found"
  | "package_not_found"
  | "interview_not_found"
  | "interview_expired"
  | "identity_version_conflict"
  | "idempotency_conflict"
  | "payment_webhook_invalid"
  | "download_token_invalid"
  | "download_token_expired"
  | "download_token_revoked"
  | "download_limit_exceeded"
  | "asset_not_available"
  | "asset_not_linked_to_token"
  | "signed_url_creation_failed"
  | "email_template_missing"
  | "email_provider_not_configured"
  | "email_delivery_failed"
  | "customer_pii_encryption_not_configured"
  | "admin_unauthorized"
  | "admin_forbidden"
  | "admin_reason_required"
  | "rate_limited"
  | "internal_error";

export interface ErrorContract {
  contract_version: "1.1";
  schema_version: string;
  created_at: string;
  updated_at: string;
  source: "system_generated";
  error_code: ApiErrorCode;
  message: string;
  user_message: string;
  retryable: boolean;
  severity: "low" | "medium" | "high";
  affected_field: string | null;
  debug_context: Record<string, unknown>;
}

export class ApiException extends HttpException {
  readonly errorCode: ApiErrorCode;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly severity: "low" | "medium" | "high";
  readonly affectedField: string | null;
  readonly debugContext: Record<string, unknown>;

  constructor(input: {
    errorCode: ApiErrorCode;
    message: string;
    userMessage: string;
    status?: HttpStatus;
    retryable?: boolean;
    severity?: "low" | "medium" | "high";
    affectedField?: string | null;
    debugContext?: Record<string, unknown>;
  }) {
    super(input.message, input.status ?? HttpStatus.BAD_REQUEST);
    this.errorCode = input.errorCode;
    this.userMessage = input.userMessage;
    this.retryable = input.retryable ?? false;
    this.severity = input.severity ?? "medium";
    this.affectedField = input.affectedField ?? null;
    this.debugContext = input.debugContext ?? {};
  }
}

export function createErrorContract(error: ApiException | Error): ErrorContract {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiException) {
    return {
      contract_version: "1.1",
      schema_version: "2026-06-29",
      created_at: timestamp,
      updated_at: timestamp,
      source: "system_generated",
      error_code: error.errorCode,
      message: error.message,
      user_message: error.userMessage,
      retryable: error.retryable,
      severity: error.severity,
      affected_field: error.affectedField,
      debug_context: error.debugContext
    };
  }

  return {
    contract_version: "1.1",
    schema_version: "2026-06-29",
    created_at: timestamp,
    updated_at: timestamp,
    source: "system_generated",
    error_code: "internal_error",
    message: "Unexpected internal error.",
    user_message: "Something went wrong. Please try again later.",
    retryable: true,
    severity: "high",
    affected_field: null,
    debug_context: {
      error_name: error.name
    }
  };
}
