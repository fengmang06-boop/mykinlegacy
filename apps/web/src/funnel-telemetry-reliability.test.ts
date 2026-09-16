import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { INTERVIEW_STEPS } from "./lib/interview-contract";
import { funnelPayload, prepareFunnelEmission, telemetryPagePath } from "./lib/funnel-telemetry";
import { ga4EventFor, trackEvent } from "./lib/analytics";

const SESSION = "00000000-0000-4000-8000-000000000001";
let memory: Map<string, string>;
let storage: Pick<Storage, "getItem" | "setItem">;
let gtag: ReturnType<typeof vi.fn>;
let beacon: ReturnType<typeof vi.fn>;
let nextUuid: number;
const uuid = () => `00000000-0000-4000-8000-${String(++nextUuid).padStart(12, "0")}`;

function created(id: string) { trackEvent("create_started", { interview_id: id }); }
function completed(id: string) {
  trackEvent("questionnaire_completed", { interview_id: id, stage_count: 5 });
  trackEvent("funnel_step_completed", { step_name: "guided_interview", interview_id: id });
}
function count(name: string) { return gtag.mock.calls.filter((args) => args[1] === name).length; }
function bodies() { return beacon.mock.calls.map((args) => args[1] as Blob); }

beforeEach(() => {
  memory = new Map([["mykinlegacy_conversion_flow_id", SESSION]]);
  storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } };
  gtag = vi.fn(); beacon = vi.fn(() => true); nextUuid = 1;
  vi.stubGlobal("window", {
    location: { hostname: "mykinlegacy.test", pathname: "/gifts/father-retirement", search: "" },
    sessionStorage: storage, innerWidth: 390,
    navigator: { userAgent: "Mozilla Chrome" }, gtag, crypto: { randomUUID: uuid }
  });
  vi.stubGlobal("document", { cookie: "", referrer: "" });
  vi.stubGlobal("navigator", { sendBeacon: beacon });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No test may reach a network"); }));
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("required questionnaire emission tests (local GA4/first-party sinks only)", () => {
  it("TEST1 normal five-step completion emits one questionnaire event", () => {
    created("interview-1");
    for (const step of INTERVIEW_STEPS) trackEvent("interview_step_completed", { interview_id: "interview-1", step_code: step.code });
    completed("interview-1");
    expect(count("questionnaire_completed")).toBe(1);
    expect(count("interview_step_completed")).toBe(5);
  });
  it("TEST2 repeated completion callbacks after consecutive clicks emit once", () => {
    created("interview-1");
    for (let i = 0; i < 10; i++) completed("interview-1");
    expect(count("questionnaire_completed")).toBe(1);
  });
  it("TEST3 repeated rerender/observer notifications cannot reemit completion", () => {
    created("interview-1"); completed("interview-1");
    trackEvent("funnel_step_viewed", { step_name: "confirm_identity", interview_id: "interview-1" });
    completed("interview-1");
    expect(count("questionnaire_completed")).toBe(1);
  });
  it("TEST4 route transition/remount with same stored journey emits once", async () => {
    created("interview-1"); completed("interview-1");
    vi.resetModules();
    const remounted = await import("./lib/analytics");
    remounted.trackEvent("questionnaire_completed", { interview_id: "interview-1" });
    expect(count("questionnaire_completed")).toBe(1);
  });
  it("TEST5 refresh after completion with same browser storage does not replay", async () => {
    created("interview-1"); completed("interview-1");
    vi.resetModules();
    const refreshed = await import("./lib/analytics");
    refreshed.trackEvent("create_started", { interview_id: "interview-1" });
    refreshed.trackEvent("questionnaire_completed", { interview_id: "interview-1" });
    expect(count("create_started")).toBe(1);
    expect(count("questionnaire_completed")).toBe(1);
  });
  it("TEST6 three separate questionnaire flows emit three, not six", () => {
    for (let i = 1; i <= 3; i++) { created(`interview-${i}`); completed(`interview-${i}`); }
    expect(count("questionnaire_completed")).toBe(3);
    const ids = gtag.mock.calls.filter((args) => args[1] === "questionnaire_completed").map((args) => args[2].funnel_instance_id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe(SESSION);
  });
  it("TEST7 each step is one logical completion with the correct step_number", () => {
    created("interview-1");
    for (const step of INTERVIEW_STEPS) {
      for (let repeat = 0; repeat < 3; repeat++) trackEvent("interview_step_completed", { interview_id: "interview-1", step_code: step.code });
    }
    const events = gtag.mock.calls.filter((args) => args[1] === "interview_step_completed");
    expect(events).toHaveLength(5);
    expect(events.map((args) => args[2].step_number)).toEqual([1, 2, 3, 4, 5]);
    trackEvent("interview_step_completed", { interview_id: "interview-1", step_code: "unknown" });
    expect(count("interview_step_completed")).toBe(5);
  });
});

describe("minimal correlation, privacy, transport and call-site contracts", () => {
  it("ROOT_CAUSE baseline maps explicit plus generic completion to two GA4 events", () => {
    const baseline = execFileSync("git", ["show", "5d31015a0b13a09fd0b7969c8903a6e0adfe6226:apps/web/src/lib/analytics.ts"], { encoding: "utf8" });
    const javascript = ts.transpileModule(baseline, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { ga4EventFor?: typeof ga4EventFor } = {};
    runInNewContext(javascript, { exports, process: { env: {} } });
    const names = [exports.ga4EventFor!("questionnaire_completed"), exports.ga4EventFor!("funnel_step_completed", { step_name: "guided_interview" })];
    expect(names.filter((event) => event?.name === "questionnaire_completed")).toHaveLength(2);
  });
  it("landing/create/steps/questionnaire/checkout/paid-return share existing anonymous UUID", async () => {
    trackEvent("landing_cta_clicked", { source: "gift_hero", destination: "/create" });
    created("interview-1");
    for (const step of INTERVIEW_STEPS) trackEvent("interview_step_completed", { interview_id: "interview-1", step_code: step.code });
    completed("interview-1");
    trackEvent("order_created", { interview_id: "interview-1", order_number: "order-1" });
    trackEvent("checkout_started", { order_number: "order-1" });
    trackEvent("purchase_completed", { order_number: "order-1" });
    trackEvent("payment_success", { order_number: "order-1" });
    expect(count("purchase_completed")).toBe(1);
    expect(new Set(gtag.mock.calls.map((args) => args[2].funnel_instance_id))).toEqual(new Set([SESSION]));
    for (const args of gtag.mock.calls) {
      expect(args[2]).not.toHaveProperty("session_id");
      expect(args[2]).not.toHaveProperty("source");
      expect(args[2]).not.toHaveProperty("medium");
      expect(args[2]).not.toHaveProperty("device_category");
      expect(args[2]).not.toHaveProperty("interview_id");
      expect(args[2]).not.toHaveProperty("order_number");
    }
    const parsed = await Promise.all(bodies().map(async (blob) => JSON.parse(await blob.text())));
    const stepBodies = parsed.filter((body) => body.data.event_name === "interview_step_completed");
    expect(stepBodies.map((body) => body.data.metadata.step_number)).toEqual([1, 2, 3, 4, 5]);
    expect(stepBodies.every((body) => body.data.metadata.flow_id === SESSION)).toBe(true);
  });
  it("a second landing+create rotates a journey ID, without a second parallel generator", () => {
    created("interview-1"); completed("interview-1");
    trackEvent("landing_cta_clicked", { destination: "/create" });
    created("interview-2"); completed("interview-2");
    const relevant = gtag.mock.calls.slice(-3).map((args) => args[2].funnel_instance_id);
    expect(new Set(relevant).size).toBe(1);
    expect(relevant[0]).not.toBe(SESSION);
  });
  it("canonical questionnaire is the sole GA4 mapping; no generic guided alias", () => {
    expect(ga4EventFor("funnel_step_completed", { step_name: "guided_interview" })).toBeNull();
    expect(ga4EventFor("questionnaire_completed")?.name).toBe("questionnaire_completed");
  });
  it("funnel allowlist drops contact/answer/nested secrets in both sinks", async () => {
    created("interview-1");
    trackEvent("questionnaire_completed", {
      interview_id: "interview-1", email: "synthetic@example.invalid", name: "synthetic",
      raw_answer: { free_text: "synthetic confidential answer" }, arbitrary: "synthetic confidential answer",
      signed_url: "https://example.invalid/private?token=synthetic"
    });
    const serialized = JSON.stringify(gtag.mock.calls) + (await Promise.all(bodies().map((blob) => blob.text()))).join("");
    expect(serialized).not.toContain("synthetic");
    expect(funnelPayload({ free_text: "discard", nested: { email: "discard" } })).toEqual({});
  });
  it("strips dynamic identifiers and all queries/tokens from GA4 page_path", () => {
    expect(telemetryPagePath("/create/synthetic-id/confirm?email=discard#fragment")).toBe("/create/:id/confirm");
    expect(telemetryPagePath("/checkout/synthetic-order")).toBe("/checkout/:id");
    expect(telemetryPagePath("/download/secret-token")).toBe("/download/:token");
  });
  it("internal QA, owner, monitor, local and demo emissions never reach either sink", () => {
    for (const type of ["CODEX_QA", "OWNER_INTERNAL", "AUTOMATED_MONITOR", "DEVELOPMENT"]) {
      window.location.search = `?mkl_traffic_type=${type}`;
      created("interview-1"); completed("interview-1");
    }
    window.location.search = ""; window.location.hostname = "localhost";
    created("interview-1");
    window.location.hostname = "mykinlegacy.test";
    trackEvent("purchase_completed", { order_number: "FD-synthetic", mode: "founder_demo" });
    expect(gtag).not.toHaveBeenCalled(); expect(beacon).not.toHaveBeenCalled();
  });
  it("storage denial/corruption fails closed and cannot interrupt the workflow", () => {
    const denied = { getItem: () => { throw new Error("denied"); }, setItem: vi.fn() };
    expect(prepareFunnelEmission("questionnaire_completed", { interview_id: "interview-1" }, SESSION, denied, uuid)).toBeNull();
    storage.setItem("mykinlegacy_funnel_telemetry_v1", "broken JSON");
    expect(() => completed("interview-1")).not.toThrow();
    expect(count("questionnaire_completed")).toBe(0);
  });
  it("failed beacon falls back to one fetch, without a second logical emission", () => {
    beacon.mockReturnValue(false);
    const localFetch = vi.fn(async (_url: string, _options: { body: string }) => ({ ok: true })); vi.stubGlobal("fetch", localFetch);
    created("interview-1"); completed("interview-1"); completed("interview-1");
    const countBodies = localFetch.mock.calls.filter((args) => JSON.parse((args[1] as { body: string }).body).data.event_name === "questionnaire_completed");
    expect(countBodies).toHaveLength(1); expect(count("questionnaire_completed")).toBe(1);
  });
  it("current submit call sites carry interview identity and stay after successful API save", () => {
    const source = readFileSync(new URL("./components/interview-flow.tsx", import.meta.url), "utf8");
    expect(source.indexOf("await api.submitInterviewAnswer")).toBeLessThan(source.indexOf('trackEvent("interview_step_completed"'));
    expect(source).toContain('trackEvent("interview_step_completed", { step_code: step.code, interview_id: interviewId }');
    expect(source).toMatch(/trackEvent\("questionnaire_completed", \{\s*stage_count: INTERVIEW_STEPS.length,\s*interview_id: interviewId/);
    expect(source.match(/trackEvent\("questionnaire_completed"/g)).toHaveLength(1);
    const confirm = readFileSync(new URL("./components/confirm-flow.tsx", import.meta.url), "utf8");
    expect(confirm).toMatch(/order_number: order.order_number,\s*interview_id: interviewId/);
  });
});
