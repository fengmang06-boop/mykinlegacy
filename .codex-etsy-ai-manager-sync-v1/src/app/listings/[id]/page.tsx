import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseStringList } from "@/lib/json";
import { analyzeKeywords } from "@/lib/engines/keyword-intelligence-engine";
import { createPromotionPlan } from "@/lib/engines/promotion-planner";
import { scoreBestsellerPotential } from "@/lib/engines/bestseller-potential-engine";
import { scoreThumbnail } from "@/lib/engines/thumbnail-score-engine";
import { RewriteDraftButton } from "./RewriteDraftButton";
import { ExportPackageButton } from "./ExportPackageButton";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      images: true,
      aiReports: { orderBy: { updatedAt: "desc" }, take: 1 },
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
      recommendations: { orderBy: [{ priority: "asc" }, { createdAt: "desc" }] },
      bestsellerScores: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  if (!listing) notFound();

  const engineListing = {
    title: listing.title,
    description: listing.description,
    price: listing.price,
    quantity: listing.quantity,
    state: listing.state,
    tags: parseStringList(listing.tags),
    materials: parseStringList(listing.materials),
    productType: listing.productType,
    targetCustomer: listing.targetCustomer,
    images: listing.images
  };
  const keywords = analyzeKeywords(engineListing);
  const promotion = createPromotionPlan(engineListing, keywords);
  const bestseller = listing.bestsellerScores[0] ?? scoreBestsellerPotential(engineListing);
  const thumbnail = scoreThumbnail(engineListing);
  const score = listing.scores[0];
  const aiReport = listing.aiReports[0];
  const aiActions = aiReport?.recommendedActions ? JSON.parse(aiReport.recommendedActions) as {
    summary?: string;
    title?: { strengths?: string[]; weaknesses?: string[]; suggestedTitle?: string };
    tags?: { unusedKeywordOpportunities?: string[]; suggestedReplacementTags?: string[]; weakTags?: string[]; duplicateMeaning?: string[] };
    images?: { suggestions?: string[] };
    conversion?: { risk?: string; suggestions?: string[] };
    priorityReasons?: string[];
  } : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{listing.productType}</h1>
          <p>{listing.title}</p>
        </div>
        <a className="button secondary" href="/listings">Back to listings</a>
      </div>

      <section className="grid metrics">
        <div className="metric"><span>AI SEO</span><strong>{aiReport?.seoScore ?? score?.seoScore ?? 0}</strong></div>
        <div className="metric"><span>CTR</span><strong>{score?.ctrScore ?? 0}</strong></div>
        <div className="metric"><span>AI Conversion</span><strong>{aiReport?.conversionScore ?? score?.conversionScore ?? 0}</strong></div>
        <div className="metric"><span>AI Priority</span><strong className="compact-value">{aiReport?.overallPriority ?? "Not run"}</strong></div>
      </section>

      <section className="grid metrics" style={{ marginTop: 16 }}>
        <div className="metric"><span>Title Score</span><strong>{aiReport?.titleScore ?? 0}</strong></div>
        <div className="metric"><span>Tag Score</span><strong>{aiReport?.tagScore ?? 0}</strong></div>
        <div className="metric"><span>Image Score</span><strong>{aiReport?.imageScore ?? thumbnail.thumbnailScore}</strong></div>
        <div className="metric"><span>Risk Level</span><strong className="compact-value">{aiReport?.riskLevel ?? thumbnail.mobileThumbnailRisk}</strong></div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>AI Summary</h2>
          <p className="muted">{aiActions?.summary ?? "No AI report has been generated for this listing yet."}</p>
          <div className="chips">
            <span className="chip">Pricing {aiReport?.pricingScore ?? 0}</span>
            <span className="chip">Competition {aiReport?.competitionScore ?? 0}</span>
            <span className="chip">Freshness {aiReport?.freshnessScore ?? 0}</span>
            <span className="chip">{aiReport?.analysisVersion ?? "not analyzed"}</span>
          </div>
        </div>
        <div className="panel">
          <h2>Priority Reasons</h2>
          <div className="list">
            {(aiActions?.priorityReasons?.length ? aiActions.priorityReasons : ["Run /api/etsy/ai/analyze to generate recommendations."]).map((item) => (
              <p className="muted" key={item}>{item}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Title Suggestions</h2>
          <p><span className="label">Suggested Title</span><br />{aiActions?.title?.suggestedTitle ?? "No title suggestion yet."}</p>
          <p><span className="label">Strengths</span></p>
          <div className="chips">{(aiActions?.title?.strengths ?? []).map((item) => <span className="chip" key={item}>{item}</span>)}</div>
          <p><span className="label">Weaknesses</span></p>
          <div className="list">{(aiActions?.title?.weaknesses ?? []).map((item) => <p className="muted" key={item}>{item}</p>)}</div>
        </div>
        <div className="panel">
          <h2>Tag Suggestions</h2>
          <p><span className="label">Suggested Replacement Tags</span></p>
          <div className="chips">{(aiActions?.tags?.suggestedReplacementTags ?? []).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
          <p><span className="label">Unused Keyword Opportunities</span></p>
          <div className="chips">{(aiActions?.tags?.unusedKeywordOpportunities ?? []).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Image Suggestions</h2>
          <div className="list">{(aiActions?.images?.suggestions ?? []).map((item) => <p className="muted" key={item}>{item}</p>)}</div>
        </div>
        <div className="panel">
          <h2>Conversion Suggestions</h2>
          <p><span className="label">Risk</span><br />{aiActions?.conversion?.risk ?? aiReport?.riskLevel ?? "Not analyzed"}</p>
          <div className="list">{(aiActions?.conversion?.suggestions ?? []).map((item) => <p className="muted" key={item}>{item}</p>)}</div>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Listing Basics</h2>
          <p><span className="label">Price</span><br />${listing.price}</p>
          <p><span className="label">Target Customer</span><br />{listing.targetCustomer}</p>
          <p><span className="label">Materials</span><br />{engineListing.materials.join(", ")}</p>
          <p><span className="label">Description</span><br />{listing.description}</p>
          <div className="chips">
            {engineListing.tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
          </div>
        </div>

        <div className="panel">
          <h2>Keyword Intelligence</h2>
          <p><span className="label">Primary Keyword</span><br />{keywords.primaryKeyword}</p>
          <p><span className="label">Missing Keywords</span><br />{keywords.missingKeywords.join(", ") || "No major gaps"}</p>
          <p><span className="label">Buyer Intent</span><br />{keywords.buyerIntentKeywords.join(", ") || "None detected"}</p>
          <p><span className="label">Gift Keywords</span><br />{keywords.giftKeywords.join(", ") || "None detected"}</p>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Image / Thumbnail Problems</h2>
          <div className="list">
            {listing.images.map((image) => (
              <div className="listing-row" key={image.id}>
                <strong>{image.role}</strong>
                <span className="muted">{image.alt}</span>
              </div>
            ))}
            {listing.images.length < 3 ? <p className="muted">Add thumbnail, scale, detail, material proof, and packaging images.</p> : null}
          </div>
          <h3 style={{ marginTop: 18 }}>First Image Fix Plan</h3>
          <div className="list">
            {thumbnail.firstImageFixPlan.map((item) => <span className="chip" key={item}>{item}</span>)}
          </div>
          <h3 style={{ marginTop: 18 }}>Recommended Image Order</h3>
          <p className="muted">{thumbnail.recommendedImageOrder.join(" > ")}</p>
        </div>

        <div className="panel">
          <h2>Bestseller Reasons / Conversion Problems</h2>
          <p><span className="label">Bestseller Reasons</span></p>
          <pre>{typeof bestseller.reasons === "string" ? bestseller.reasons : JSON.stringify(bestseller.reasons, null, 2)}</pre>
          <p><span className="label">Next Actions</span></p>
          <pre>{typeof bestseller.nextActions === "string" ? bestseller.nextActions : JSON.stringify(bestseller.nextActions, null, 2)}</pre>
          <p><span className="label">Conversion Fix Priorities</span></p>
          <pre>{score?.fixPriorities ?? "No score data yet. Run npm run mock:sync."}</pre>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Recommended Optimization Actions</h2>
        <div className="list">
          {listing.recommendations.map((recommendation) => (
            <div className="recommendation" key={recommendation.id}>
              <div className="row-head">
                <strong>{recommendation.type}</strong>
                <span className="chip">{recommendation.priority}</span>
              </div>
              <span className="muted">{recommendation.reason}</span>
              <div className="split">
                <div className="snapshot">{recommendation.currentValue}</div>
                <div className="snapshot">{recommendation.suggestedValue}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2>Promotion Planner</h2>
          <p><span className="label">Pinterest Pin Title</span><br />{promotion.pinterestPinTitle}</p>
          <p><span className="label">Pinterest Description</span><br />{promotion.pinterestPinDescription}</p>
          <p><span className="label">Instagram Caption</span><br />{promotion.instagramCaption}</p>
          <p><span className="label">Facebook Post</span><br />{promotion.facebookPost}</p>
          <p><span className="label">Coupon</span><br />{promotion.etsyCouponSuggestion}</p>
          <p><span className="label">Blog Topic</span><br />{promotion.blogTopicSuggestion}</p>
        </div>

        <div className="panel">
          <h2>Etsy Listing Rewrite Draft</h2>
          <RewriteDraftButton listingId={listing.id} />
          <div style={{ marginTop: 16 }}>
            <ExportPackageButton listingId={listing.id} />
          </div>
        </div>
      </section>
    </>
  );
}
