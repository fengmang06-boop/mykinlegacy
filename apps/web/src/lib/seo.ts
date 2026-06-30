import type { Metadata } from "next";

export const SITE_URL = "https://mykinlegacy.com";
export const BRAND_NAME = "MyKinLegacy";
export const PRODUCT_NAME = "Family Legacy Collection";
export const SUPPORT_EMAIL = "support@mykinlegacy.com";

export function publicMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_URL}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: BRAND_NAME,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description
    },
    robots: { index: true, follow: true }
  };
}
