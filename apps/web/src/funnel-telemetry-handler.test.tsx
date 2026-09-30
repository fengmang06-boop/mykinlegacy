import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { INTERVIEW_STEPS } from "./lib/interview-contract";
import { InterviewFlow } from "./components/interview-flow";

// Local hook/controller harness invokes the real submit callback; it is not a mobile DOM test.
const hook = vi.hoisted(() => ({ index: 0, step: 0, submit: vi.fn(async (_id: string, _answer: { step_code: string }) => ({})), push: vi.fn() }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return { ...actual,
    useState: (initial: unknown) => {
      const values = [hook.step, ["Local QA choice"], "", null, false];
      return [values[hook.index++] ?? initial, vi.fn()];
    },
    useRef: (initial: unknown) => ({ current: initial }),
    useMemo: (factory: () => unknown) => factory(), useEffect: () => {}
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hook.push }) }));
vi.mock("./lib/api-client", () => ({ ApiClient: class { submitInterviewAnswer = hook.submit; } }));

let gtag: ReturnType<typeof vi.fn>;
function continueButton(element: unknown): (() => void) | undefined {
  if (!React.isValidElement(element)) return;
  const props = element.props as { children?: unknown; onClick?: () => void };
  if (element.type === "button" && props.children === "Continue") return props.onClick;
  for (const child of React.Children.toArray(props.children as React.ReactNode)) {
    const result = continueButton(child); if (result) return result;
  }
}
function renderCallback(id: string, step: number): () => void {
  hook.index = 0; hook.step = step;
  const callback = continueButton(InterviewFlow({ interviewId: id }));
  expect(callback).toBeTypeOf("function"); return callback!;
}
const count = (event: string) => gtag.mock.calls.filter((call) => call[1] === event).length;

beforeEach(() => {
  vi.stubGlobal("React", React);
  const memory = new Map<string, string>(); let serial = 0;
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
  gtag = vi.fn(); hook.submit.mockClear(); hook.push.mockClear();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("window", { location: { hostname: "mykinlegacy.test", pathname: "/create/local-fixture", search: "" }, sessionStorage: storage,
    navigator: { userAgent: "Mozilla Chrome" }, innerWidth: 390, gtag,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}` } });
  vi.stubGlobal("document", { cookie: "", referrer: "" });
  vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No external network allowed"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("real interview submit handler with local hooks/API/analytics sinks", () => {
  it("three actual five-step submit sequences produce three questionnaire and15 step events", async () => {
    for (let flow = 1; flow <= 3; flow++) {
      for (let step = 0; step < 5; step++) {
        const before = hook.submit.mock.calls.length;
        renderCallback(`local-flow-${flow}`, step)();
        await vi.waitFor(() => expect(hook.submit.mock.calls.length).toBe(before + 1));
        await vi.waitFor(() => expect(count("interview_step_completed")).toBe((flow - 1) * 5 + step + 1));
      }
    }
    expect(count("questionnaire_completed")).toBe(3);
    expect(hook.push.mock.calls.filter((call) => call[0].endsWith("/confirm"))).toHaveLength(3);
    const steps = gtag.mock.calls.filter((call) => call[1] === "interview_step_completed");
    expect(steps.map((call) => call[2].step_number)).toEqual([1,2,3,4,5,1,2,3,4,5,1,2,3,4,5]);
    expect(hook.submit.mock.calls.map((call) => call[1].step_code)).toEqual(Array.from({length:3}, () => INTERVIEW_STEPS.map((step) => step.code)).flat());
  });
  it("concurrent complete clicks, rerender and remount callbacks cannot duplicate telemetry", async () => {
    const callback = renderCallback("local-flow-1", 4);
    for (let i = 0; i < 10; i++) callback();
    await vi.waitFor(() => expect(hook.push).toHaveBeenCalledTimes(10));
    renderCallback("local-flow-1", 4)();
    renderCallback("local-flow-1", 4)();
    await vi.waitFor(() => expect(hook.push).toHaveBeenCalledTimes(12));
    expect(count("questionnaire_completed")).toBe(1);
    expect(count("interview_step_completed")).toBe(1);
    // Telemetry does not change existing API/button behavior: successful requests still complete.
    expect(hook.submit).toHaveBeenCalledTimes(12);
  });
  it("failed actual answer save emits no completion and a subsequent successful retry emits once", async () => {
    hook.submit.mockRejectedValueOnce(new Error("Local simulated save failure"));
    renderCallback("local-flow-1", 4)();
    await vi.waitFor(() => expect(hook.submit).toHaveBeenCalledTimes(1));
    expect(count("questionnaire_completed")).toBe(0);
    renderCallback("local-flow-1", 4)();
    await vi.waitFor(() => expect(count("questionnaire_completed")).toBe(1));
  });
});
