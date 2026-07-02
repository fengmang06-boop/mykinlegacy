import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../database/prisma.service";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  it("stores safe funnel metadata without PII or vault tokens", async () => {
    const prisma = createPrisma();
    const service = new AnalyticsService(prisma as unknown as PrismaService);

    await service.track(
      {
        event_name: "vault_opened",
        order_number: "AHL-20260703-01TEST",
        step_name: "Vault",
        duration_ms: 1234.4,
        metadata: {
          customer_email: "customer@example.com",
          download_token: "raw-token",
          signed_url: "https://private.example.com/file",
          source: "order_status",
          nested: { secret: "hidden", safe: "kept" }
        }
      },
      { ip: "127.0.0.1", userAgent: "vitest" }
    );

    expect(prisma.db.auditLog.create).toHaveBeenCalledOnce();
    const created = vi.mocked(prisma.db.auditLog.create).mock.calls[0]?.[0].data;
    expect(created).toMatchObject({
      actorType: "customer",
      action: "vault_opened",
      entityType: "conversion_funnel",
      entityId: "01JTESTORDER0000000000000"
    });
    expect(created?.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(created?.metadataJson)).toContain("order_id");
    expect(JSON.stringify(created?.metadataJson)).toContain("source");
    expect(JSON.stringify(created?.metadataJson)).not.toContain("customer@example.com");
    expect(JSON.stringify(created?.metadataJson)).not.toContain("raw-token");
    expect(JSON.stringify(created?.metadataJson)).not.toContain("private.example.com");
    expect(JSON.stringify(created?.metadataJson)).not.toContain("hidden");
  });

  it("rejects unsupported events", async () => {
    const service = new AnalyticsService(createPrisma() as unknown as PrismaService);
    await expect(service.track({ event_name: "customer_email_captured" })).rejects.toThrow(
      "Unsupported analytics event"
    );
  });
});

function createPrisma() {
  return {
    db: {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "01JTESTORDER0000000000000",
          orderNumber: "AHL-20260703-01TEST"
        })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    }
  };
}
