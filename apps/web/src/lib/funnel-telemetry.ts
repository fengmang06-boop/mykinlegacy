import { INTERVIEW_STEPS } from "./interview-contract";

// Anonymous, browser-local correlation and at-most-once emission. Not a delivery receipt.
export const FUNNEL_TELEMETRY_VERSION = "mkl-funnel-telemetry-v1";
const STORAGE_KEY = "mykinlegacy_funnel_telemetry_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STEP_CODES = INTERVIEW_STEPS.map((step) => step.code);

interface State {
  pending?: string;
  interviews: Record<string, string>;
  orders: Record<string, string>;
  seen: string[];
}

export interface FunnelEmission {
  funnel_instance_id: string;
  step_number?: number;
  emit: boolean;
}

export function interviewStepNumber(code: unknown): number | undefined {
  const index = STEP_CODES.indexOf(code as typeof STEP_CODES[number]);
  return index < 0 ? undefined : index + 1;
}

export function prepareFunnelEmission(
  event: string,
  payload: Record<string, unknown>,
  sessionId: string | undefined,
  storage: Pick<Storage, "getItem" | "setItem">,
  uuid: () => string
): FunnelEmission | null {
  // Storage failure fails closed for telemetry, never for the customer workflow.
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const state: State = raw ? JSON.parse(raw) : { interviews: {}, orders: {}, seen: [] };
    if (!state.interviews || !state.orders || !Array.isArray(state.seen)) return null;
    const interview = typeof payload.interview_id === "string" ? payload.interview_id : undefined;
    const order = typeof payload.order_number === "string" ? payload.order_number : undefined;
    const existingIds = Object.values(state.interviews);
    const fresh = () => {
      // Reuse the existing anonymous UUID on the first journey; rotate only for a new create.
      const value = existingIds.length === 0 && UUID.test(sessionId ?? "") ? sessionId! : uuid();
      if (!UUID.test(value)) throw new Error("anonymous_uuid_unavailable");
      return value;
    };
    let id: string | undefined;
    if (event === "landing_cta_clicked") {
      id = state.pending ?? fresh();
      state.pending = id;
    } else if (interview) {
      id = state.interviews[interview];
      if (!id) {
        id = event === "create_started" ? state.pending ?? fresh() : fresh();
        state.interviews[interview] = id;
      }
      if (event === "create_started") state.pending = undefined;
      if (event === "order_created" && order) state.orders[order] = id;
    } else if (order) {
      id = state.orders[order];
      if (!id) {
        // A payment return in a new tab cannot reconstruct the original journey. Do not guess.
        if (event !== "checkout_started" && event !== "purchase_completed") return null;
        id = uuid();
        if (!UUID.test(id)) return null;
        state.orders[order] = id;
      }
    } else {
      return null;
    }
    if (!UUID.test(id)) return null;
    const step = event === "interview_step_completed" ? interviewStepNumber(payload.step_code) : undefined;
    if (event === "interview_step_completed" && step === undefined) return null;
    // Each step is one logical completion per interview, including successful Back/Edit retries.
    const once = ["create_started", "questionnaire_started", "interview_step_completed", "questionnaire_completed", "checkout_started", "purchase_completed"].includes(event);
    const key = event === "purchase_completed"
      ? `${id}:${event}:${order}`
      : `${id}:${event}:${step ?? "completed"}`;
    const emit = !once || !state.seen.includes(key);
    if (once && emit) state.seen.push(key);
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { funnel_instance_id: id, ...(step ? { step_number: step } : {}), emit };
  } catch {
    return null;
  }
}

// No answers, contact data, arbitrary nested metadata or query strings enter the funnel sinks.
export function funnelPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ["interview_id", "order_number", "step_code", "mode", "product_code"]) {
    const value = payload[key];
    if (typeof value === "string" && /^[a-z0-9_-]{1,100}$/i.test(value)) result[key] = value;
  }
  for (const key of ["source", "cta_source"]) {
    const value = payload[key];
    if (typeof value === "string" && /^[a-z0-9_-]{1,80}$/i.test(value)) result[key] = value;
  }
  if (typeof payload.destination === "string" && /^\/[a-z0-9/_-]*$/i.test(payload.destination)) {
    result.destination = payload.destination.slice(0, 100);
  }
  return result;
}

export function telemetryPagePath(path: string): string {
  return path.split(/[?#]/)[0]!
    .replace(/^(\/create|\/checkout|\/order-status)\/[^/]+/, "$1/:id")
    .replace(/^\/download\/[^/]+/, "/download/:token");
}
