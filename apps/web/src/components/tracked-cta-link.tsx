"use client";

import Link from "next/link";
import React from "react";
import type { ComponentProps, MouseEvent } from "react";

import { trackEvent } from "../lib/analytics";

type TrackedCtaLinkProps = ComponentProps<typeof Link> & {
  trackingSource: string;
};

export function TrackedCtaLink({ trackingSource, href, onClick, ...props }: TrackedCtaLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackEvent("landing_cta_clicked", {
      source: trackingSource,
      destination: typeof href === "string" ? href : href.pathname ?? "/create"
    });
    onClick?.(event);
  }

  return <Link {...props} href={href} onClick={handleClick} />;
}
