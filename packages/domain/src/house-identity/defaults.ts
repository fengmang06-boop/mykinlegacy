import type { ContractMetadata, TextStrategy } from "./types";

export const HOUSE_IDENTITY_CONTRACT_VERSION = "1.1" as const;
export const HOUSE_IDENTITY_SCHEMA_VERSION = "house_identity.v1";
export const DEFAULT_LOCALE = "en-US";
export const DEFAULT_OUTPUT_LANGUAGE = "en";
export const DEFAULT_FALLBACK_LANGUAGE = "en";
export const DEFAULT_VISUAL_STYLE = "classic_heritage";
export const DEFAULT_ORIGIN_COUNTRY = "unknown";
export const DEFAULT_FAMILY_VALUES = ["unity"] as const;
export const DEFAULT_COLORS = ["deep_navy", "gold", "ivory"] as const;

export const DEFAULT_FORBIDDEN_ELEMENTS = [
  "readable text in generated images",
  "copyrighted logos",
  "trademarked symbols",
  "official legal heraldic claims"
] as const;

export const DEFAULT_TEXT_STRATEGY: TextStrategy = {
  include_text_in_image: false,
  render_text_server_side: true,
  text_fields: ["house_name", "motto"],
  text_render_targets: ["certificate_pdf", "poster_pdf", "social_kit", "wallpaper"]
};

export function createContractMetadata(source: string, timestamp = new Date()): ContractMetadata {
  const isoTimestamp = timestamp.toISOString();

  return {
    contract_version: HOUSE_IDENTITY_CONTRACT_VERSION,
    schema_version: HOUSE_IDENTITY_SCHEMA_VERSION,
    created_at: isoTimestamp,
    updated_at: isoTimestamp,
    source
  };
}
