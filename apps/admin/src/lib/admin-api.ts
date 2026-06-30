export class AdminApiClient {
  constructor(private readonly baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1") {}

  login(email: string, password: string) {
    return this.request("/admin/login", { method: "POST", body: { email, password } });
  }

  getDashboard() {
    return this.request("/admin/dashboard");
  }

  private async request(path: string, options: { method?: string; body?: Record<string, unknown> } = {}) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method: options.method ?? "GET",
      headers: { "content-type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    return response.json();
  }
}
