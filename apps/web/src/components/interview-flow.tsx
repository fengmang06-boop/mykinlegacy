"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiClient } from "../lib/api-client";
import { trackEvent } from "../lib/analytics";
import { INTERVIEW_STEPS } from "../lib/interview-contract";
import {
  readInterviewDraft,
  writeInterviewAnswer,
  writeInterviewStepIndex
} from "../lib/interview-draft";
import { getSafetyMessage } from "../lib/safety";

const finalHomepageAsset = "/assets/final-homepage";

export function InterviewFlow({ interviewId }: { interviewId: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const api = useMemo(() => new ApiClient(), []);
  const step = INTERVIEW_STEPS[stepIndex] ?? INTERVIEW_STEPS[0];
  const safetyMessage = getSafetyMessage(`${selected.join(" ")} ${freeText}`);
  const completedRef = useRef(false);
  const activeStepCodeRef = useRef(step.code);
  const founderDemoMode =
    process.env.NODE_ENV === "development" && interviewId.startsWith("founder-demo-");

  useEffect(() => {
    const draft = readInterviewDraft(window.sessionStorage, interviewId);
    const requestedStepValue = new URLSearchParams(window.location.search).get("step");
    const requestedStep = requestedStepValue === null ? null : Number(requestedStepValue);
    const initialStep = requestedStep !== null && Number.isInteger(requestedStep) && requestedStep >= 0
      ? Math.min(requestedStep, INTERVIEW_STEPS.length - 1)
      : Math.min(draft.current_step_index, INTERVIEW_STEPS.length - 1);
    const initialStepDefinition = INTERVIEW_STEPS[initialStep] ?? INTERVIEW_STEPS[0]!;
    const initialAnswer = draft.answers[initialStepDefinition.code];
    setStepIndex(initialStep);
    setSelected(initialAnswer?.selected_options ?? []);
    setFreeText(initialAnswer?.free_text ?? "");
    trackEvent("funnel_step_viewed", {
      step_name: "guided_interview",
      interview_id: interviewId
    });
  }, [interviewId]);

  useEffect(() => {
    activeStepCodeRef.current = step.code;
    trackEvent("funnel_step_viewed", {
      step_name: `interview_${step.code}`,
      interview_id: interviewId
    });
  }, [interviewId, step.code]);

  useEffect(() => {
    function recordAbandonment() {
      if (completedRef.current) return;
      trackEvent("interview_abandoned", {
        interview_id: interviewId,
        step_code: activeStepCodeRef.current
      });
    }
    window.addEventListener("pagehide", recordAbandonment);
    return () => window.removeEventListener("pagehide", recordAbandonment);
  }, [interviewId]);

  function goToStep(nextStepIndex: number) {
    const boundedStepIndex = Math.max(0, Math.min(nextStepIndex, INTERVIEW_STEPS.length - 1));
    const draft = writeInterviewStepIndex(window.sessionStorage, interviewId, boundedStepIndex);
    const nextStep = INTERVIEW_STEPS[boundedStepIndex] ?? INTERVIEW_STEPS[0]!;
    const savedAnswer = draft.answers[nextStep.code];
    setStepIndex(boundedStepIndex);
    setSelected(savedAnswer?.selected_options ?? []);
    setFreeText(savedAnswer?.free_text ?? "");
    setError(null);
  }

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
    const startedAt = performance.now();
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
      }
      const nextStepIndex = Math.min(stepIndex + 1, INTERVIEW_STEPS.length);
      writeInterviewAnswer(
        window.sessionStorage,
        interviewId,
        {
          step_code: step.code,
          selected_options: answer.raw_answer.selected_options,
          free_text: answer.raw_answer.free_text
        },
        nextStepIndex
      );
      if (process.env.NODE_ENV === "development") {
        console.info("[interview] step saved", {
          step_code: step.code,
          duration_ms: Math.round(performance.now() - startedAt)
        });
      }
      window.sessionStorage.setItem(
        `ai_heritage_interview_${interviewId}`,
        JSON.stringify({ current_step: step.code, selected })
      );
      const durationMs = Math.round(performance.now() - startedAt);
      trackEvent("interview_step_completed", { step_code: step.code }, { durationMs });
      trackEvent(
        "funnel_step_completed",
        { step_name: `interview_${step.code}`, interview_id: interviewId },
        { stepName: `interview_${step.code}`, durationMs }
      );
      if (stepIndex >= INTERVIEW_STEPS.length - 1) {
        completedRef.current = true;
        trackEvent("funnel_step_completed", {
          step_name: "guided_interview",
          interview_id: interviewId
        });
        router.push(`/create/${interviewId}/confirm`);
        return;
      }
      goToStep(stepIndex + 1);
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
          <div className="transaction-visual-card" aria-label="Private collection preview">
            <Image
              src={`${finalHomepageAsset}/02_homepage/hero/hero-private-vault.webp`}
              width={620}
              height={520}
              alt=""
              aria-hidden="true"
              priority
              unoptimized
            />
            <div>
              <span>Step {stepIndex + 1}</span>
              <strong>{step.question}</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="journey-shell">
        <div className="section interview-layout">
          <div className="journey-card">
            <p className="eyebrow">
              Step {stepIndex + 1} of {INTERVIEW_STEPS.length}
            </p>
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${((stepIndex + 1) / INTERVIEW_STEPS.length) * 100}%` }} />
            </div>
            <h2>{step.question}</h2>
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
              {stepIndex > 0 ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => goToStep(stepIndex - 1)}
                  disabled={saving}
                >
                  Back
                </button>
              ) : null}
              <button
                className="button"
                type="button"
                onClick={() => void submitStep()}
                disabled={saving}
              >
                {saving ? "Saving answer..." : "Continue"}
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
            <p className="muted">Answers are saved in this browser session so you can review them before checkout.</p>
          </div>
          <aside className="interview-preview" aria-label="Collection preview">
            <div className="preview-cover">
              <Image
                src={`${finalHomepageAsset}/09_extras/extra-private-archive-wide.webp`}
                width={520}
                height={360}
                alt=""
                aria-hidden="true"
                unoptimized
              />
              <strong>Collection Preview</strong>
              <span>
                This helps us shape the collection around the person receiving it, not just the
                family name.
              </span>
            </div>
            <div className="preview-steps">
              {INTERVIEW_STEPS.map((item, index) => (
                <span className="preview-step" key={item.code}>
                  <strong>{item.label}</strong>
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
