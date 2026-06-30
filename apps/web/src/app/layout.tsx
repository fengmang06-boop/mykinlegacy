import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { BRAND_NAME, PRODUCT_NAME, SITE_URL, SUPPORT_EMAIL } from "../lib/seo";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND_NAME} | ${PRODUCT_NAME}`,
  description:
    "Meaningful private family keepsakes for parents, grandparents, and families who deserve more than another ordinary gift.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: BRAND_NAME,
    description:
      "Meaningful private family keepsakes for parents, grandparents, and families who deserve more than another ordinary gift.",
    url: SITE_URL,
    siteName: BRAND_NAME,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description:
      "Meaningful private family keepsakes for parents, grandparents, and families who deserve more than another ordinary gift."
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    email: SUPPORT_EMAIL
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <header className="site-header">
          <nav className="nav" aria-label="Primary navigation">
            <Link className="brand" href="/">
              MyKinLegacy
            </Link>
            <div className="nav-links">
              <Link href="/family-legacy-collection">Collection</Link>
              <Link href="/#how-it-works">How It Works</Link>
              <Link href="/#gift-ideas">Gift Ideas</Link>
              <Link href="/#faq">FAQ</Link>
              <Link className="nav-cta" href="/create">
                Begin Their Legacy
              </Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-inner">
            Private by default. Personalized heritage-inspired symbolic keepsakes for gifting and
            personal keeping; not official arms or genealogy claims.
            <div className="footer-links">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/refund-policy">Refund Policy</Link>
              <Link href="/digital-delivery">Digital Delivery</Link>
              <Link href="/disclaimer">Disclaimer</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
