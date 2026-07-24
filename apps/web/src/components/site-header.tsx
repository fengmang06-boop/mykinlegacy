"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";

const links = [
  ["Collection", "/family-legacy-collection"],
  ["Examples", "/real-examples"],
  ["Gift Ideas", "/#gift-ideas"],
  ["Journal", "/journal"],
  ["How It Works", "/#how-it-works"],
  ["FAQ", "/#faq"]
] as const;

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
      <path d="M32 4 55 13v19c0 16.2-8.6 28.8-23 35.7C17.6 60.8 9 48.2 9 32V13L32 4Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M21 47V24l11 13 11-13v23M21 24l11 15 11-15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <path d="M17 17h30" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(({ restoreFocus }: { restoreFocus: boolean }) => {
    setOpen(false);
    if (!restoreFocus) return;
    window.setTimeout(() => {
      menuButton.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = dialog.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
    focusable?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open]);

  return (
    <header className="site-header">
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <BrandMark />
          <span className="brand-copy">
            <span className="brand-name">MyKinLegacy</span>
            <span className="brand-tagline">Legacy, Designed.</span>
          </span>
        </Link>
        <div className="nav-links">
          {links.map(([label, href]) => (
            <Link href={href} key={label} aria-current={href === pathname ? "page" : undefined}>{label}</Link>
          ))}
          <Link className="nav-cta" href="/create">Begin Their Legacy</Link>
        </div>
        <div className="mobile-nav-actions">
          <Link className="mobile-header-cta" href="/create">Begin Their Legacy</Link>
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => open ? closeMenu({ restoreFocus: true }) : setOpen(true)}
            ref={menuButton}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </nav>
      {open ? (
        <div className="mobile-menu-layer">
          <div
            className="mobile-menu-backdrop"
            aria-hidden="true"
            onClick={() => closeMenu({ restoreFocus: true })}
          />
          <div className="mobile-menu-panel" id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation menu" ref={dialog}>
            <div className="mobile-menu-heading">
              <span>Explore MyKinLegacy</span>
              <button type="button" onClick={() => closeMenu({ restoreFocus: true })} aria-label="Close navigation menu">Close</button>
            </div>
            <div className="mobile-menu-links">
              {links.map(([label, href]) => (
                <Link href={href} key={label} aria-current={href === pathname ? "page" : undefined} onClick={() => closeMenu({ restoreFocus: false })}>{label}</Link>
              ))}
              <Link className="mobile-menu-primary" href="/create" onClick={() => closeMenu({ restoreFocus: false })}>Begin Their Legacy</Link>
            </div>
            <p>Private digital collection · Founder reviewed · USD $49</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
