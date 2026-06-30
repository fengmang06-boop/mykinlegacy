export type AdminRole = "super_admin" | "admin" | "support" | "finance" | "viewer";

export type AdminAction =
  | "admin_login"
  | "failed_admin_login"
  | "view_private_family_data"
  | "view_asset_preview"
  | "create_download_token"
  | "revoke_download_token"
  | "revoke_asset"
  | "retry_generation_job"
  | "retry_failed_asset"
  | "resend_email"
  | "create_prompt_version"
  | "activate_prompt_version"
  | "retire_prompt_version"
  | "edit_knowledge_library"
  | "refund_request_placeholder"
  | "payment_sync_placeholder"
  | "change_admin_role"
  | "delete_anonymize_data_placeholder";

export interface AdminSession {
  session_id: string;
  admin_user_id: string;
  email_hash: string;
  roles: AdminRole[];
  permissions: string[];
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  actor_type: "admin" | "system";
  actor_id: string | null;
  action: AdminAction;
  entity_type: string;
  entity_id: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  reason: string | null;
  ip_hash: string | null;
  user_agent_hash: string | null;
  created_at: string;
}
