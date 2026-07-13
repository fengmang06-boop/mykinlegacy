import type { Metadata } from "next";

export const SITE_URL = "https://mykinlegacy.com";
export const BRAND_NAME = "MyKinLegacy";
export const PRODUCT_NAME = "Family Legacy Collection";
export const SUPPORT_EMAIL = "support@mykinlegacy.com";
export const DEFAULT_SOCIAL_IMAGE =
  "/assets/final-homepage/02_homepage/hero/hero-main-crest.webp";

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const image = absoluteUrl(input.image ?? DEFAULT_SOCIAL_IMAGE);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: BRAND_NAME,
      type: "website",
      images: [{ url: image, alt: `${BRAND_NAME} ${PRODUCT_NAME}` }]
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image]
    },
    robots: { index: true, follow: true }
  };
}
