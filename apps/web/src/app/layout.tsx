import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Inter } from "next/font/google";
import type { ReactNode } from "react";
import Link from "next/link";

import { GoogleAnalytics } from "../components/google-analytics";
import { BrandMark, SiteHeader } from "../components/site-header";

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
        <SiteHeader />
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
