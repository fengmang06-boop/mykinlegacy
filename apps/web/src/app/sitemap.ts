import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mykinlegacy.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicPaths = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/family-legacy-collection", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/family-crest-generator", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/ai-family-crest-generator", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/heritage-gift", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/family-legacy-gift", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/symbolic-family-crest", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/support", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/refund-policy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/digital-delivery", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/disclaimer", priority: 0.3, changeFrequency: "yearly" as const }
  ];

  return publicPaths.map((entry) => ({
    url: `${SITE_URL}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority
  }));
}
