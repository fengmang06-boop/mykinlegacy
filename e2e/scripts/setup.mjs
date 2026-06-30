const requiredDefaults = {
  AI_PROVIDER: "mock",
  EMAIL_PROVIDER: "mock",
  STORAGE_PROVIDER: "local_private",
  APP_WEB_URL: "http://localhost:3000",
  API_URL: "http://localhost:4000",
  ADMIN_URL: "http://localhost:3001"
};

for (const [key, value] of Object.entries(requiredDefaults)) {
  process.env[key] ||= value;
}

console.log("E2E setup complete. Mock providers are expected for local MVP tests.");
