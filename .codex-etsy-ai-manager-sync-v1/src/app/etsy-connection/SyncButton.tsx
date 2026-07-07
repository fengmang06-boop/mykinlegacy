"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SyncButtonProps = {
  disabled?: boolean;
};

export function SyncButton({ disabled = false }: SyncButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = isPending || message === "Syncing Etsy data...";

  async function runSync() {
    setMessage("Syncing Etsy data...");
    setError(null);
    try {
      const response = await fetch("/api/etsy/sync", { method: "POST" });
      const payload = (await response.json()) as { message?: string; errors?: string[] };
      if (!response.ok && response.status !== 207) {
        throw new Error(payload.message ?? "Etsy sync failed.");
      }
      setMessage(payload.message ?? "Etsy sync finished.");
      if (payload.errors?.length) setError(payload.errors.slice(0, 3).join("\n"));
      startTransition(() => router.refresh());
    } catch (syncError) {
      setMessage(null);
      setError(syncError instanceof Error ? syncError.message : String(syncError));
    }
  }

  return (
    <div className="sync-action">
      <button className="button" type="button" onClick={runSync} disabled={disabled || busy}>
        <RefreshCw size={16} />
        {busy ? "Syncing" : "Sync Etsy"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
      {error ? <pre>{error}</pre> : null}
    </div>
  );
}
