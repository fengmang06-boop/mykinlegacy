"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { ApiClient } from "../lib/api-client";
import { trackEvent, trackFunnelStepViewed } from "../lib/analytics";

const finalHomepageAsset = "/assets/final-homepage";

export function CreateStart() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const api = useMemo(() => new ApiClient(), []);
  const founderDemoMode = process.env.NODE_ENV === "development";

  useEffect(() => trackFunnelStepViewed("create_page", { page: "/create" }), []);

  function beginFounderDemo() {
    const interview = api.createFounderDemoInterview();
    window.sessionStorage.setItem("ai_heritage_interview_id", interview.interview_id);
    window.sessionStorage.setItem(
      `mykinlegacy_founder_demo_interview_${interview.interview_id}`,
      JSON.stringify({ interview_id: interview.interview_id, answers: [] })
    );
    trackEvent("interview_started", {
      interview_id: interview.interview_id,
      mode: "founder_demo"
    });
    trackEvent("funnel_step_completed", {
      step_name: "create_page",
      interview_id: interview.interview_id,
      mode: "founder_demo"
    });
    router.push(`/create/${interview.interview_id}`);
  }

  async function begin() {
    setLoading(true);
    setError(null);
    try {
      const interview = await api.createInterview();
      window.sessionStorage.setItem("ai_heritage_interview_id", interview.interview_id);
      trackEvent("interview_started", { interview_id: interview.interview_id });
      trackEvent("funnel_step_completed", {
        step_name: "create_page",
        interview_id: interview.interview_id
      });
      router.push(`/create/${interview.interview_id}`);
    } catch {
      setError(
        founderDemoMode
          ? "We could not reach the local API. Use Founder Demo Mode to run the front-end order flow."
          : "We could not start the interview. Please retry."
      );
      setLoading(false);
    }
  }

  return (
    <>
      <section className="premium-hero interview-hero">
        <div className="section interview-hero-grid">
          <div>
            <p className="eyebrow">Gift-first guided interview</p>
            <h1>Who is this collection for?</h1>
            <p className="lead">
              This helps us shape the collection around the person receiving it, not just the family
              name. Start with the parent, grandparent, couple, or family moment you want to honor.
            </p>
            <div className="trust-row">
              <span>Private by default</span>
              <span>Made for gifting</span>
              <span>Digital delivery</span>
            </div>
          </div>
          <div className="create-hero-visual" aria-label="Private legacy collection preview">
            <Image
              src={`${finalHomepageAsset}/09_extras/extra-study-wide.webp`}
              width={760}
              height={520}
              alt=""
              aria-hidden="true"
              priority
            />
            <div>
              <span>Their legacy begins</span>
              <strong>with being recognized.</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="premium-section journey-shell">
        <div className="section interview-layout">
          <div className="journey-card">
            <p className="eyebrow">Private gift journey</p>
            <h1>Begin their Family Legacy Collection</h1>
            <p className="lead">
              Answer a few focused questions so the collection can reflect who it is for, what they
              mean to your family, and what should be remembered.
            </p>
            {error ? <p className="error">{error}</p> : null}
            <button className="button" type="button" onClick={begin} disabled={loading}>
              {loading ? "Starting..." : "Begin Their Legacy"}
            </button>
            <div className="create-trust-strip" aria-label="Journey confidence">
              <span>Takes about 3 minutes</span>
              <span>Review before final delivery</span>
              <span>Private by default</span>
              <span>Gift-ready collection</span>
            </div>
            {founderDemoMode ? (
              <button
                className="secondary-button"
                type="button"
                onClick={beginFounderDemo}
                disabled={loading}
              >
                Founder Demo Mode
              </button>
            ) : null}
          </div>
          <aside className="interview-preview" aria-label="Collection preview">
            <div className="preview-cover">
              <Image
                src={`${finalHomepageAsset}/09_extras/extra-private-archive-wide.webp`}
                width={520}
                height={360}
                alt=""
                aria-hidden="true"
              />
              <strong>Collection Preview</strong>
              <span>Your answers help shape a private keepsake for someone your family loves.</span>
            </div>
            <div className="preview-artifacts" aria-label="Preview artifacts">
              <span>
                <Image
                  src={`${finalHomepageAsset}/04_homepage/features/feature-heritage-certificate.webp`}
                  width={180}
                  height={130}
                  alt=""
                  aria-hidden="true"
                />
                Archive Certificate
              </span>
              <span>
                <Image
                  src={`${finalHomepageAsset}/04_homepage/features/feature-family-story.webp`}
                  width={180}
                  height={130}
                  alt=""
                  aria-hidden="true"
                />
                Story
              </span>
              <span>
                <Image
                  src={`${finalHomepageAsset}/04_homepage/features/feature-private-vault.webp`}
                  width={180}
                  height={130}
                  alt=""
                  aria-hidden="true"
                />
                Vault
              </span>
            </div>
            <div className="preview-steps">
              <span className="preview-step">
                <strong>Recipient</strong>
                <span>1</span>
              </span>
              <span className="preview-step">
                <strong>Story</strong>
                <span>2</span>
              </span>
              <span className="preview-step">
                <strong>Values</strong>
                <span>3</span>
              </span>
              <span className="preview-step">
                <strong>Symbols</strong>
                <span>4</span>
              </span>
              <span className="preview-step">
                <strong>Style</strong>
                <span>5</span>
              </span>
              <span className="preview-step">
                <strong>Review</strong>
                <span>6</span>
              </span>
            </div>
            <p className="notice">Your answers are private and secure.</p>
          </aside>
        </div>
      </section>
    </>
  );
}
