import { createHash, randomBytes } from "node:crypto";

import type { EmailLogRecord, EmailLogRepository } from "./types";

export class InMemoryEmailLogRepository implements EmailLogRepository {
  public readonly logs: EmailLogRecord[] = [];

  async createEmailLog(input: EmailLogRecord): Promise<EmailLogRecord> {
    this.logs.push(input);
    return input;
  }
}

export function hashEmailAddress(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function createEmailLogId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(16);
  let output = "";
  for (let i = 0; i < 26; i += 1) {
    output += alphabet[(bytes[i % bytes.length] ?? 0) % alphabet.length] ?? "0";
  }
  return output;
}
