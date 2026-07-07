"use client";

import { BrainCircuit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AnalyzeButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = isPending || message === "Analyzing listings...";

  async function analyze(retry = false) {
    setMessage("Analyzing listings...");
    setError(null);
    try {
      const response = await fetch("/api/etsy/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry })
      });
      const payload = (await response.json()) as { analyzed?: number; skipped?: number; totalReports?: number; errors?: string[] };
      if (!response.ok && response.status !== 207) throw new Error(payload.errors?.[0] ?? "AI analysis failed.");
      setMessage(`Analyzed ${payload.analyzed ?? 0}, skipped ${payload.skipped ?? 0}, reports ${payload.totalReports ?? 0}.`);
      if (payload.errors?.length) setError(payload.errors.slice(0, 3).join("\n"));
      startTransition(() => router.refresh());
    } catch (analysisError) {
      setMessage(null);
      setError(analysisError instanceof Error ? analysisError.message : String(analysisError));
    }
  }

  return (
    <div className="sync-action">
      <div className="button-row">
        <button className="button" type="button" onClick={() => analyze(false)} disabled={busy}>
          <BrainCircuit size={16} />
          {busy ? "Analyzing" : "Analyze"}
        </button>
        <button className="button secondary" type="button" onClick={() => analyze(true)} disabled={busy}>
          Retry All
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
      {error ? <pre>{error}</pre> : null}
    </div>
  );
}
