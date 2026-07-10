import fs from "node:fs";
import path from "node:path";

function formatEnvValue(value: string): string {
  if (value === "" || /[\s"#\\]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export function saveEnvValues(values: Record<string, string | undefined | null>, envPath = path.join(process.cwd(), ".env.local")): string[] {
  const updates = Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "")
  );
  const keys = new Set(Object.keys(updates));
  if (!keys.size) return [];

  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const kept = existing.filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !keys.has(match[1]);
  });
  const nextLines = kept
    .filter((line) => line.trim() !== "")
    .concat(Object.entries(updates).map(([key, value]) => `${key}=${formatEnvValue(value)}`));

  fs.writeFileSync(envPath, `${nextLines.join("\n")}\n`, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
  Object.assign(process.env, updates);
  return Object.keys(updates);
}
