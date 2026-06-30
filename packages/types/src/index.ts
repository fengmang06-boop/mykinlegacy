export interface HealthStatus {
  status: "ok" | "ready";
  service: string;
}
