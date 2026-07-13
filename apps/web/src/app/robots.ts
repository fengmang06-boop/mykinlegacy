import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mykinlegacy.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/family-legacy-collection",
        "/real-examples",
        "/gifts",
        "/family-crest-generator",
        "/ai-family-crest-generator",
        "/heritage-gift",
        "/family-legacy-gift",
        "/symbolic-family-crest",
        "/support",
        "/privacy",
        "/terms",
        "/refund-policy",
        "/digital-delivery",
        "/disclaimer"
      ],
      disallow: [
        "/create",
        "/checkout",
        "/payment",
        "/order-status",
        "/download",
        "/admin",
        "/api",
        "/review"
      ]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
