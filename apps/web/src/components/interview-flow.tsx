"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiClient } from "../lib/api-client";
import { trackEvent } from "../lib/analytics";
import { getSafetyMessage } from "../lib/safety";

const STEPS = [
  {
    code: "name_your_house",
    question: "Who is this collection for?",
    options: [
      "My father",
      "My mother",
      "My parents",
      "A grandparent",
      "A couple",
      "Our whole family"
    ],
    required: true
  },
  {
    code: "where_story_begins",
    question: "What moment makes this gift meaningful now?",
    options: [
      "Father's Day",
      "Mother's Day",
      "Christmas",
      "Retirement",
      "Anniversary",
      "Family reunion"
    ],
    required: true
  },
  {
    code: "define_house_values",
    question: "Which values should this collection honor?",
    options: ["Courage", "Wisdom", "Loyalty", "Resilience", "Faith", "Creativity"],
    required: true
  },
  {
    code: "choose_guardian_symbol",
    question: "What should they feel recognized for?",
    options: [
      "Protecting the family",
      "Keeping traditions alive",
      "Working hard for others",
      "Holding everyone together",
      "Teaching by example",
      "Building a home"
    ],
    required: true
  },
  {
    code: "select_colors_and_visual_style",
    question: "Which symbol or style feels right for your family?",
    options: [
      "Deep green and gold",
      "Black and silver",
      "Blue and white",
      "Medieval",
      "Celtic",
      "Gothic"
    ],
    required: true
  }
] as const;

export function InterviewFlow({ interviewId }: { interviewId: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const api = useMemo(() => new ApiClient(), []);
  const step = STEPS[stepIndex] ?? STEPS[0];
  const safetyMessage = getSafetyMessage(`${selected.join(" ")} ${freeText}`);
  const founderDemoMode =
    process.env.NODE_ENV === "development" && interviewId.startsWith("founder-demo-");

  function toggleOption(option: string) {
    setSelected((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    );
  }

  async function submitStep(skip = false) {
    if (!skip && step.required && selected.length === 0 && freeText.trim().length === 0) {
      setError("Please choose an option or add a short answer.");
      return;
    }
    if (safetyMessage) {
      setError(safetyMessage);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const answer = {
        step_code: step.code,
        raw_answer: {
          selected_options: skip ? [] : selected,
          free_text: skip ? "" : freeText.trim()
        }
      };
      if (founderDemoMode) {
        const storageKey = `mykinlegacy_founder_demo_interview_${interviewId}`;
        const existing = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "{}") as {
          answers?: unknown[];
        };
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            interview_id: interviewId,
            answers: [...(existing.answers ?? []), answer]
          })
        );
      } else {
        await api.submitInterviewAnswer(interviewId, answer);
        if (freeText.trim()) {
          await api.normalizeInterviewInput(interviewId, freeText.trim());
        }
      }
      window.sessionStorage.setItem(
        `ai_heritage_interview_${interviewId}`,
        JSON.stringify({ current_step: step.code, selected })
      );
      trackEvent("interview_step_completed", { step_code: step.code });
      if (stepIndex >= STEPS.length - 1) {
        router.push(`/create/${interviewId}/confirm`);
        return;
      }
      setStepIndex((current) => current + 1);
      setSelected([]);
      setFreeText("");
    } catch {
      setError("We could not save this answer. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="interview-hero">
        <div className="section interview-hero-grid">
          <div>
            <p className="eyebrow">Gift-first guided interview</p>
            <h1>Shape a collection around the person receiving it</h1>
            <p className="lead">
              Your answers stay private and help shape a meaningful keepsake for parents,
              grandparents, or the family moment you want to honor.
            </p>
            {founderDemoMode ? <p className="notice">Founder Demo Mode: local preview flow.</p> : null}
          </div>
          <div className="mock-certificate">
            <span>Step {stepIndex + 1}</span>
            <strong>{step.question}</strong>
          </div>
        </div>
      </section>
      <section className="journey-shell">
        <div className="section interview-layout">
          <div className="journey-card">
            <p className="eyebrow">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
            </div>
            <h1>{step.question}</h1>
            <div className="option-grid">
              {step.options.map((option) => (
                <button
                  className="option"
                  data-selected={selected.includes(option)}
                  key={option}
                  type="button"
                  onClick={() => toggleOption(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Add your own words</span>
              <textarea value={freeText} onChange={(event) => setFreeText(event.target.value)} />
            </label>
            {safetyMessage ? <p className="notice">{safetyMessage}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <div className="button-row">
              <button
                className="button"
                type="button"
                onClick={() => void submitStep()}
                disabled={saving}
              >
                {saving ? "Saving..." : "Continue"}
              </button>
              {!step.required ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void submitStep(true)}
                  disabled={saving}
                >
                  Skip
                </button>
              ) : null}
            </div>
          </div>
          <aside className="interview-preview" aria-label="Collection preview">
            <div className="preview-cover">
              <strong>Collection Preview</strong>
              <span>
                This helps us shape the collection around the person receiving it, not just the
                family name.
              </span>
            </div>
            <div className="preview-steps">
              {STEPS.map((item, index) => (
                <span className="preview-step" key={item.code}>
                  <strong>{stepLabel(item.code)}</strong>
                  <span>
                    {index < stepIndex ? "Done" : index === stepIndex ? "In progress" : index + 1}
                  </span>
                </span>
              ))}
            </div>
            <p className="notice">No public gallery is created by default.</p>
          </aside>
        </div>
      </section>
    </>
  );
}

function stepLabel(code: string): string {
  const labels: Record<string, string> = {
    name_your_house: "Recipient",
    where_story_begins: "Moment",
    define_house_values: "Values",
    choose_guardian_symbol: "Recognition",
    select_colors_and_visual_style: "Style",
    create_or_refine_motto: "Words"
  };
  return labels[code] ?? code;
}
