import { readFile } from "node:fs/promises";
import net from "node:net";

const repoRoot = new URL("..", import.meta.url);

const config = {
  apiBaseUrl: process.env.STAGING_API_BASE_URL ?? "http://localhost:4000",
  webBaseUrl: process.env.STAGING_WEB_BASE_URL ?? "http://localhost:3000",
  adminBaseUrl: process.env.STAGING_ADMIN_BASE_URL ?? "http://localhost:3001",
  mysqlHost: process.env.STAGING_MYSQL_HOST ?? "127.0.0.1",
  mysqlPort: Number(process.env.STAGING_MYSQL_PORT ?? 3307),
  redisHost: process.env.STAGING_REDIS_HOST ?? "127.0.0.1",
  redisPort: Number(process.env.STAGING_REDIS_PORT ?? 6380)
};

const checks = [];

await checkEnvExample();
await checkTcp("mysql_reachable", config.mysqlHost, config.mysqlPort);
await checkTcp("redis_reachable", config.redisHost, config.redisPort);
await checkHttp("api_health", `${config.apiBaseUrl}/health`, 200);
await checkHttp("api_products", `${config.apiBaseUrl}/api/v1/products`, 200);
await checkHttp("web_home", `${config.webBaseUrl}/`, 200);
await checkHttp("web_product", `${config.webBaseUrl}/family-legacy-collection`, 200);
await checkHttp("admin_login_or_dashboard", `${config.adminBaseUrl}/admin/login`, 200);
await checkHttp("web_robots", `${config.webBaseUrl}/robots.txt`, 200, [
  "/create",
  "/checkout",
  "/download",
  "/admin"
]);
await checkHttp("web_sitemap", `${config.webBaseUrl}/sitemap.xml`, 200, [
  "https://mykinlegacy.com",
  "/family-legacy-collection"
]);
await checkWorkerStaticReadiness();

const failed = checks.filter((check) => check.status === "failed");
console.log(JSON.stringify({ status: failed.length === 0 ? "passed" : "failed", checks }, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}

async function checkEnvExample() {
  const source = await readFile(new URL(".env.staging.example", repoRoot), "utf8");
  const required = [
    'NODE_ENV="staging"',
    'AI_PROVIDER="mock"',
    'EMAIL_PROVIDER="mock"',
    'STORAGE_PROVIDER="local_private"',
    'STRIPE_SECRET_KEY="replace_me_test_key_only"',
    'STRIPE_WEBHOOK_SECRET="replace_me_test_webhook_secret"',
    'CLEANUP_DESTRUCTIVE_ENABLED="false"'
  ];
  const missing = required.filter((item) => !source.includes(item));
  const forbidden = [/sk_live/i, /whsec_live/i, /OPENAI_API_KEY="sk-/i, /RESEND_API_KEY="re_/i].filter(
    (pattern) => pattern.test(source)
  );
  checks.push({
    name: "staging_env_example_safe_defaults",
    status: missing.length === 0 && forbidden.length === 0 ? "passed" : "failed",
    details: { missing, forbidden_count: forbidden.length }
  });
}

async function checkTcp(name, host, port) {
  const result = await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "timeout" });
    }, 2500);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve({ ok: true });
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: error.message });
    });
  });
  checks.push({
    name,
    status: result.ok ? "passed" : "failed",
    details: { host, port, error: result.error ?? null }
  });
}

async function checkHttp(name, url, expectedStatus, requiredText = []) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    clearTimeout(timeout);
    const missingText = requiredText.filter((text) => !body.includes(text));
    checks.push({
      name,
      status: response.status === expectedStatus && missingText.length === 0 ? "passed" : "failed",
      details: { url, status_code: response.status, missing_text: missingText }
    });
  } catch (error) {
    checks.push({
      name,
      status: "failed",
      details: { url, error: error instanceof Error ? error.message : "unknown_error" }
    });
  }
}

async function checkWorkerStaticReadiness() {
  const source = await readFile(new URL("apps/worker/src/app.ts", repoRoot), "utf8");
  const required = ["getWorkerStatus", "queue_count", "worker_count", "outbox_dispatcher_enabled"];
  const missing = required.filter((item) => !source.includes(item));
  checks.push({
    name: "worker_startup_contract_present",
    status: missing.length === 0 ? "passed" : "failed",
    details: {
      mode: "static_contract_check",
      missing,
      note: "Live worker startup is verified by container/process logs during staging run."
    }
  });
}
