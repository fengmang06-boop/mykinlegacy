"use client";

import { useEffect } from "react";

import { trackFunnelStepViewed } from "../lib/analytics";

export function FunnelStepTracker({
  stepName,
  metadata = {}
}: {
  stepName: string;
  metadata?: Record<string, unknown>;
}) {
  useEffect(() => trackFunnelStepViewed(stepName, metadata), [stepName, metadata]);
  return null;
}
