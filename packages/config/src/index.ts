export type AppEnv = "local" | "test" | "staging" | "production";

export interface AppConfig {
  appEnv: AppEnv;
  apiPort: number;
  appBaseUrl: string;
  adminBaseUrl: string;
  apiBaseUrl: string;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    appEnv: (env.APP_ENV as AppEnv | undefined) ?? "local",
    apiPort: readNumber(env.API_PORT, 4000),
    appBaseUrl: env.APP_BASE_URL ?? "http://localhost:3000",
    adminBaseUrl: env.ADMIN_BASE_URL ?? "http://localhost:3001",
    apiBaseUrl: env.API_BASE_URL ?? "http://localhost:4000"
  };
}
