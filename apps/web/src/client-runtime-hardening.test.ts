import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./lib/api-client";
import { trackEvent, trackFunnelStepViewed } from "./lib/analytics";

describe("client runtime hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not throw when analytics browser APIs reject or throw", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("sendBeacon blocked");
      }
    });
    vi.stubGlobal("fetch", () => {
      throw new Error("fetch blocked");
    });

    expect(() => trackEvent("funnel_step_viewed", { page: "/create" })).not.toThrow();
    expect(() => {
      const cleanup = trackFunnelStepViewed("create_page", { page: "/create" });
      cleanup();
    }).not.toThrow();
  });

  it("does not fail requests before fetch when session storage is unavailable", async () => {
    const getItem = vi.fn(() => {
      throw new Error("storage blocked");
    });
    const setItem = vi.fn(() => {
      throw new Error("storage blocked");
    });
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem,
        setItem
      }
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        request_id: "req_test",
        correlation_id: "corr_test",
        success: true,
        data: { products: [] },
        error: null
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ApiClient("/api/v1").getProducts()).resolves.toEqual({ products: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getItem).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
