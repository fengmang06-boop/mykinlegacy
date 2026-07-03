import { StreamableFile, type CallHandler, type ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, it } from "vitest";

import { ApiResponseInterceptor } from "./response-envelope.interceptor";

describe("ApiResponseInterceptor", () => {
  it("wraps normal JSON responses in the API envelope", async () => {
    const interceptor = new ApiResponseInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(createContext(), createHandler({ ok: true }))
    );

    expect(result).toMatchObject({
      request_id: "req_test",
      correlation_id: "corr_test",
      success: true,
      data: { ok: true },
      error: null
    });
  });

  it("does not JSON-wrap StreamableFile download responses", async () => {
    const interceptor = new ApiResponseInterceptor();
    const body = Buffer.from("%PDF-1.4\n");
    const file = new StreamableFile(body);

    const result = await firstValueFrom(interceptor.intercept(createContext(), createHandler(file)));

    expect(result).toBe(file);
    expect(JSON.stringify(result)).not.toContain("request_id");
    expect(JSON.stringify(result)).not.toContain("success");
  });
});

function createContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        requestContext: {
          requestId: "req_test",
          correlationId: "corr_test"
        }
      })
    })
  } as unknown as ExecutionContext;
}

function createHandler(value: unknown): CallHandler {
  return {
    handle: () => of(value)
  };
}
