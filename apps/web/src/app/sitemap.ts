import type { MetadataRoute } from "next";

import { giftLandingPages } from "../lib/gift-landing-pages";
import { journalArticles } from "../lib/journal-articles";
import { showcaseCollections } from "../lib/showcase-collections";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mykinlegacy.com";

type SitemapEntry = {
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
  lastModified?: string;
};

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths: SitemapEntry[] = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/family-legacy-collection", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/real-examples", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/journal", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/family-crest-generator", priority: 0.8, changeFrequency: "weekly" as const },
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

  const giftPaths: SitemapEntry[] = giftLandingPages.map((page) => ({
    path: `/gifts/${page.slug}`,
    priority: 0.8,
    changeFrequency: "monthly" as const
  }));
  const examplePaths: SitemapEntry[] = showcaseCollections.map((collection) => ({
    path: `/real-examples/${collection.id}`,
    priority: 0.7,
    changeFrequency: "monthly" as const
  }));
  const journalPaths: SitemapEntry[] = journalArticles.map((article) => ({
    path: `/journal/${article.slug}`,
    priority: 0.75,
    changeFrequency: "monthly" as const,
    lastModified: article.updatedAt
  }));

  return [...publicPaths, ...giftPaths, ...examplePaths, ...journalPaths].map(
    ({ path, ...entry }) => ({
      url: `${SITE_URL}${path}`,
      ...entry
    })
  );
}
