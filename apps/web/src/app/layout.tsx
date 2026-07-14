import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Inter } from "next/font/google";
import type { ReactNode } from "react";
import Link from "next/link";

import { GoogleAnalytics } from "../components/google-analytics";

import {
  absoluteUrl,
  BRAND_NAME,
  DEFAULT_SOCIAL_IMAGE,
  PRODUCT_NAME,
  SITE_URL,
  SUPPORT_EMAIL
} from "../lib/seo";

import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body"
});

const headingFont = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"]
});

const labelFont = Cinzel({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-label",
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND_NAME} | ${PRODUCT_NAME}`,
  description:
    "Meaningful private family keepsakes for parents, grandparents, and families who deserve more than another ordinary gift.",
  alternates: { canonical: SITE_URL },
  icons: {
    icon: "/assets/homepage/brand/favicon.svg",
    shortcut: "/assets/homepage/brand/favicon.svg",
    apple: "/assets/final-homepage/01_brand/logo-mark.webp"
  },
  openGraph: {
    title: BRAND_NAME,
    description:
      "Meaningful private family keepsakes for parents, grandparents, and families who deserve more than another ordinary gift.",
    url: SITE_URL,
    siteName: BRAND_NAME,
    type: "website",
    images: [
      {
        url: absoluteUrl(DEFAULT_SOCIAL_IMAGE),
        alt: `${BRAND_NAME} ${PRODUCT_NAME}`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description:
      "Meaningful private family keepsakes for parents, grandparents, and families who deserve more than another ordinary gift.",
    images: [absoluteUrl(DEFAULT_SOCIAL_IMAGE)]
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined
};

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
      <path
        d="M32 4 55 13v19c0 16.2-8.6 28.8-23 35.7C17.6 60.8 9 48.2 9 32V13L32 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M21 47V24l11 13 11-13v23M21 24l11 15 11-15"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path d="M17 17h30" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    email: SUPPORT_EMAIL,
    logo: absoluteUrl("/assets/final-homepage/01_brand/logo-mark.webp")
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: SITE_URL,
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: SITE_URL
    }
  };

  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable} ${labelFont.variable}`}>
        <GoogleAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <header className="site-header">
          <nav className="nav" aria-label="Primary navigation">
            <Link className="brand" href="/">
              <BrandMark />
              <span className="brand-copy">
                <span className="brand-name">MyKinLegacy</span>
                <span className="brand-tagline">Legacy, Designed.</span>
              </span>
            </Link>
            <div className="nav-links">
              <Link href="/family-legacy-collection">Collection</Link>
              <Link href="/real-examples">Examples</Link>
              <Link href="/journal">Journal</Link>
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
            <div className="footer-brand-row">
              <Link className="brand footer-brand" href="/">
                <BrandMark />
                <span className="brand-copy">
                  <span className="brand-name">MyKinLegacy</span>
                  <span className="brand-tagline">Legacy, Designed.</span>
                </span>
              </Link>
            </div>
            <p>
              Private by default. Personalized heritage-inspired symbolic keepsakes for gifting and
              personal keeping; not official arms or genealogy claims.
            </p>
            <div className="footer-links">
              <Link href="/family-legacy-collection">Collection</Link>
              <Link href="/real-examples">Real Examples</Link>
              <Link href="/journal">Journal</Link>
              <Link href="/gifts/father-retirement">Gift Ideas</Link>
              <Link href="/support">Support</Link>
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
