import fs from "node:fs";
import path from "node:path";
import { difficultyFromKeyword } from "./opportunity-score";

export type KeywordRadarItem = {
  keyword: string;
  category: "High Opportunity" | "Low Competition" | "Buyer Intent" | "Gift" | "Seasonal" | "Missing";
  opportunityScore: number;
  difficulty: number;
  businessValue: number;
  reason: string;
  suggestedAction: string;
};

export type KeywordRadarResult = {
  highOpportunityKeywords: KeywordRadarItem[];
  lowCompetitionKeywords: KeywordRadarItem[];
  buyerIntentKeywords: KeywordRadarItem[];
  giftKeywords: KeywordRadarItem[];
  seasonalKeywords: KeywordRadarItem[];
  missingKeywords: KeywordRadarItem[];
};

export type KeywordRadarListing = {
  title: string;
  description: string;
  tags: string[];
  productType: string;
  targetCustomer: string;
};

type KeywordBank = Record<"product" | "style" | "material" | "buyer" | "seasonal", string[]>;

function readKeywordBank(): KeywordBank {
  const bankPath = process.env.MENSSKULL_KEYWORD_BANK_PATH
    ? path.resolve(process.env.MENSSKULL_KEYWORD_BANK_PATH)
    : path.join(process.cwd(), "..", "..", "knowledge", "mensskull-keyword-bank.md");
  const text = fs.existsSync(bankPath) ? fs.readFileSync(bankPath, "utf8") : "";
  const section = (heading: string) => {
    const match = text.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "i"));
    return match ? Array.from(match[1].matchAll(/^\* (.+)$/gm)).map((item) => item[1].trim()) : [];
  };

  return {
    product: section("Product Keywords"),
    style: section("Style Keywords"),
    material: section("Material Keywords"),
    buyer: section("Buyer Intent Keywords"),
    seasonal: section("Seasonal Keywords")
  };
}

function keywordUsage(keyword: string, listings: KeywordRadarListing[]): number {
  const parts = keyword.toLowerCase().split(/\s+/);
  return listings.filter((listing) => {
    const text = `${listing.title} ${listing.description} ${listing.tags.join(" ")} ${listing.productType} ${listing.targetCustomer}`.toLowerCase();
    return parts.every((part) => text.includes(part));
  }).length;
}

function scoreKeyword(keyword: string, category: KeywordRadarItem["category"], listings: KeywordRadarListing[]): KeywordRadarItem {
  const usage = keywordUsage(keyword, listings);
  const difficulty = difficultyFromKeyword(keyword, usage);
  const hasGiftIntent = /gift|father|birthday|christmas|anniversary|halloween|groomsmen|graduation/i.test(keyword);
  const hasBuyerIntent = /men|mens|lover|collector|biker|gothic|silver|skull|bull terrier|snake/i.test(keyword);
  const businessValue = Math.min(100, 52 + (hasBuyerIntent ? 18 : 0) + (hasGiftIntent ? 18 : 0) + (keyword.includes("silver") ? 8 : 0));
  const opportunityScore = Math.max(0, Math.min(100, Math.round(businessValue * 0.58 + (100 - difficulty) * 0.28 + (usage === 0 ? 14 : 4))));

  return {
    keyword,
    category,
    opportunityScore,
    difficulty,
    businessValue,
    reason:
      usage === 0
        ? "Keyword is missing from current listings and matches MENSSKULL buyer or gift intent."
        : "Keyword is already present but can be strengthened in titles, tags, images, or support content.",
    suggestedAction:
      usage === 0
        ? "Add to one relevant listing or test in a new product support asset."
        : "Improve placement in title opening, tags, image plan, Pinterest pin, or FAQ."
  };
}

export function runKeywordRadar(listings: KeywordRadarListing[]): KeywordRadarResult {
  const bank = readKeywordBank();
  const all = Array.from(new Set([...bank.product, ...bank.style, ...bank.material, ...bank.buyer, ...bank.seasonal]));
  const scored = all.map((keyword) => scoreKeyword(keyword, "High Opportunity", listings));
  const missing = scored.filter((item) => keywordUsage(item.keyword, listings) === 0);

  return {
    highOpportunityKeywords: [...scored].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10),
    lowCompetitionKeywords: [...scored]
      .filter((item) => item.difficulty <= 58)
      .map((item) => ({ ...item, category: "Low Competition" as const }))
      .sort((a, b) => b.businessValue - a.businessValue)
      .slice(0, 8),
    buyerIntentKeywords: bank.buyer.map((keyword) => scoreKeyword(keyword, "Buyer Intent", listings)).sort((a, b) => b.opportunityScore - a.opportunityScore),
    giftKeywords: [...bank.buyer, ...bank.seasonal]
      .filter((keyword) => /gift|father|birthday|christmas|anniversary|groomsmen|graduation/i.test(keyword))
      .map((keyword) => scoreKeyword(keyword, "Gift", listings))
      .sort((a, b) => b.opportunityScore - a.opportunityScore),
    seasonalKeywords: bank.seasonal.map((keyword) => scoreKeyword(keyword, "Seasonal", listings)).sort((a, b) => b.opportunityScore - a.opportunityScore),
    missingKeywords: missing.map((item) => ({ ...item, category: "Missing" as const })).sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10)
  };
}
