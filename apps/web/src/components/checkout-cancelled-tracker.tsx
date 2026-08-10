"use client";

import { useEffect } from "react";

import { trackEvent } from "../lib/analytics";

export function CheckoutCancelledTracker({ orderNumber }: { orderNumber?: string }) {
  useEffect(() => {
    trackEvent("checkout_cancelled", {
      ...(orderNumber ? { order_number: orderNumber } : {})
    });
  }, [orderNumber]);

  return null;
}
