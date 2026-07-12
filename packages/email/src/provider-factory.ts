import { DisabledEmailProvider } from "./disabled-providers";
import { MockEmailProvider } from "./mock-provider";
import { ResendEmailProvider } from "./resend-provider";
import type { EmailProviderAdapter } from "./types";

export function createEmailProviderFromEnv(
  env: Record<string, string | undefined> = process.env
): EmailProviderAdapter {
  const provider = normalizeEmailProviderCode(env.EMAIL_PROVIDER);
  if (provider === "mock" || provider === "log") {
    if (env.NODE_ENV?.trim().toLowerCase() === "production") {
      throw new Error("production_email_provider_must_be_real");
    }
    return new MockEmailProvider("success");
  }
  if (provider === "resend") {
    return new ResendEmailProvider({
      apiKey: env.RESEND_API_KEY,
      fromEmail: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO
    });
  }
  if (provider === "sendgrid") {
    return new DisabledEmailProvider("sendgrid");
  }
  if (provider === "ses") {
    return new DisabledEmailProvider("ses");
  }
  if (env.NODE_ENV?.trim().toLowerCase() === "production") {
    throw new Error("production_email_provider_must_be_real");
  }
  return new MockEmailProvider("success");
}

export function normalizeEmailProviderCode(value: string | undefined): string {
  const trimmed = (value ?? "mock").trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, "");
  return unquoted.trim().toLowerCase();
}
