export interface InterviewAnswerSummary {
  step_code: string;
  selected_options: string[];
  free_text: string;
}

export interface InterviewSessionDraft {
  current_step_index: number;
  answers: Record<string, InterviewAnswerSummary>;
}

const EMPTY_DRAFT: InterviewSessionDraft = {
  current_step_index: 0,
  answers: {}
};

export function interviewDraftKey(interviewId: string): string {
  return `mykinlegacy_interview_draft_${interviewId}`;
}

export function readInterviewDraft(
  storage: Pick<Storage, "getItem">,
  interviewId: string
): InterviewSessionDraft {
  try {
    const raw = storage.getItem(interviewDraftKey(interviewId));
    if (!raw) return { ...EMPTY_DRAFT, answers: {} };
    const parsed = JSON.parse(raw) as Partial<InterviewSessionDraft>;
    const answers = parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
    return {
      current_step_index: Number.isInteger(parsed.current_step_index)
        ? Math.max(0, Number(parsed.current_step_index))
        : 0,
      answers
    };
  } catch {
    return { ...EMPTY_DRAFT, answers: {} };
  }
}

export function writeInterviewAnswer(
  storage: Pick<Storage, "getItem" | "setItem">,
  interviewId: string,
  answer: InterviewAnswerSummary,
  nextStepIndex: number
): InterviewSessionDraft {
  const current = readInterviewDraft(storage, interviewId);
  const updated: InterviewSessionDraft = {
    current_step_index: Math.max(0, nextStepIndex),
    answers: { ...current.answers, [answer.step_code]: answer }
  };
  try {
    storage.setItem(interviewDraftKey(interviewId), JSON.stringify(updated));
  } catch {
    // Session storage is a convenience only; the API remains the source of truth.
  }
  return updated;
}

export function writeInterviewStepIndex(
  storage: Pick<Storage, "getItem" | "setItem">,
  interviewId: string,
  stepIndex: number
): InterviewSessionDraft {
  const current = readInterviewDraft(storage, interviewId);
  const updated = { ...current, current_step_index: Math.max(0, stepIndex) };
  try {
    storage.setItem(interviewDraftKey(interviewId), JSON.stringify(updated));
  } catch {
    // Session storage is a convenience only; the API remains the source of truth.
  }
  return updated;
}

export function formatInterviewAnswer(answer: InterviewAnswerSummary | undefined): string {
  if (!answer) return "Not answered in this browser session";
  return [...answer.selected_options, answer.free_text].filter(Boolean).join(" · ");
}
