import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/prisma-cli.mjs <prisma-command> [...args]");
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "mysql://ai_heritage:ai_heritage_dev_password@localhost:3306/ai_heritage",
  INIT_CWD: packageDir,
  PRISMA_GENERATE_SKIP_AUTOINSTALL: process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL ?? "true"
};

const result = spawnSync("prisma", [...args, "--schema", schemaPath], {
  cwd: packageDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);
