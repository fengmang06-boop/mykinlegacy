const fs = require("fs");
const path = require("path");

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

if (String(process.env.ETSY_READ_ONLY_MODE).toLowerCase() !== "true") {
  throw new Error("ETSY_READ_ONLY_MODE must be true");
}
if (String(process.env.ETSY_WRITE_APPROVED).toLowerCase() !== "false") {
  throw new Error("ETSY_WRITE_APPROVED must be false");
}

const roots = [
  path.resolve("exports", "controlled-autonomous-repair-v3"),
  path.resolve("exports", "low-signal-breakthrough"),
];
const allowedName = /^(tracking|checkpoint-(?:D1|D3|D7|D14)|execution[^/]*|post-write[^/]*)\.json$/i;
const forbiddenKey = /buyer|email|address|phone|message|access.?token|refresh.?token|client.?secret/i;

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKey.test(key)) continue;
    result[key] = sanitize(child);
  }
  return result;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && allowedName.test(entry.name)) files.push(full);
  }
  return files;
}

const evidence = [];
for (const root of roots) {
  for (const file of walk(root)) {
    try {
      evidence.push({
        path: path.relative(process.cwd(), file).replace(/\\/g, "/"),
        modified_at: fs.statSync(file).mtime.toISOString(),
        data: sanitize(JSON.parse(fs.readFileSync(file, "utf8"))),
      });
    } catch (error) {
      evidence.push({
        path: path.relative(process.cwd(), file).replace(/\\/g, "/"),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

process.stdout.write(`${JSON.stringify({
  mission: "ETSY_GROWTH_V2_001",
  exported_at: new Date().toISOString(),
  source: "production experiment files, read-only",
  safety: {
    etsy_read_only_mode: true,
    etsy_write_approved: false,
    etsy_api_calls: 0,
    production_writes: 0,
    customer_pii_exported: false,
  },
  file_count: evidence.length,
  evidence,
}, null, 2)}\n`);
