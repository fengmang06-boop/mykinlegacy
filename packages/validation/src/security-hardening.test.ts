import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..", "..", "..");
const excludedDirs = new Set(["node_modules", ".git", ".next", "dist", "coverage", "generated"]);
const secretPatterns = [
  /sk_live_[A-Za-z0-9]+/,
  /pk_live_[A-Za-z0-9]+/,
  /sk-proj-[A-Za-z0-9_-]+/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/
];

describe("repository security configuration", () => {
  it("documents production secret-manager usage and MyKinLegacy public placeholders", async () => {
    const envExample = await readFile(join(repoRoot, ".env.example"), "utf8");

    expect(envExample).toContain("secret manager");
    expect(envExample).toContain('APP_WEB_URL="https://mykinlegacy.com"');
    expect(envExample).toContain('EMAIL_FROM="support@mykinlegacy.com"');
    expect(envExample).toContain('EMAIL_REPLY_TO="support@mykinlegacy.com"');
    expect(envExample).not.toContain("support@example.com");
    expect(envExample).not.toContain("sk_test_");
    expect(envExample).not.toContain("whsec_");
  });

  it("does not contain obvious live secrets in source-controlled files", async () => {
    const files = await listTextFiles(repoRoot);
    const matches: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of secretPatterns) {
        if (pattern.test(source)) {
          matches.push(file);
        }
      }
    }

    expect(matches).toEqual([]);
  }, 30_000);
});

async function listTextFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) {
        files.push(...(await listTextFiles(join(dir, entry.name))));
      }
      continue;
    }
    if (/\.(ts|tsx|js|mjs|json|md|yml|yaml|example|prisma)$/.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}
