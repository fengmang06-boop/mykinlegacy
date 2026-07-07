import { AlertTriangle, BrainCircuit, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AnalyzeButton } from "./AnalyzeButton";

export const dynamic = "force-dynamic";

type Bucket = { label: string; count: number };

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreClass(score: number) {
  if (score >= 82) return "score good";
  if (score >= 68) return "score warn";
  return "score bad";
}

function distribution(values: number[], buckets: Array<[string, number, number]>): Bucket[] {
  return buckets.map(([label, min, max]) => ({
    label,
    count: values.filter((value) => value >= min && value <= max).length
  }));
}

function priorityRank(priority: string): number {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority as "Critical" | "High" | "Medium" | "Low"] ?? 4;
}

function Chart({ title, buckets }: { title: string; buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="chart-list">
        {buckets.map((bucket) => (
          <div className="chart-row" key={bucket.label}>
            <span>{bucket.label}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${(bucket.count / max) * 100}%` }} /></div>
            <strong>{bucket.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function EtsyAiPage() {
  const [reports, listings] = await Promise.all([
    prisma.listingAiReport.findMany({
      include: { listing: { include: { inventory: true } } },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.listing.findMany({ include: { inventory: true }, orderBy: { updatedAt: "desc" } })
  ]);

  const latestByListing = new Map<string, (typeof reports)[number]>();
  for (const report of reports) {
    if (!latestByListing.has(report.listingId)) latestByListing.set(report.listingId, report);
  }
  const latestReports = Array.from(latestByListing.values());
  const avgSeo = average(latestReports.map((report) => report.seoScore));
  const avgConversion = average(latestReports.map((report) => report.conversionScore));
  const needingAttention = latestReports.filter((report) => ["Critical", "High"].includes(report.overallPriority) || report.riskLevel === "High");
  const topOpportunities = [...latestReports]
    .sort((a, b) => priorityRank(a.overallPriority) - priorityRank(b.overallPriority) || a.seoScore + a.conversionScore - (b.seoScore + b.conversionScore))
    .slice(0, 10);
  const topRisks = [...latestReports]
    .sort((a, b) => {
      const riskOrder = { High: 0, Medium: 1, Low: 2 };
      return (riskOrder[a.riskLevel as keyof typeof riskOrder] ?? 3) - (riskOrder[b.riskLevel as keyof typeof riskOrder] ?? 3) || a.conversionScore - b.conversionScore;
    })
    .slice(0, 10);
  const priceValues = listings.map((listing) => listing.price);
  const inventoryValues = listings.map((listing) => listing.inventory?.quantity ?? listing.quantity);
  const health = average([avgSeo, avgConversion, average(latestReports.map((report) => report.imageScore)), average(latestReports.map((report) => report.pricingScore))]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Etsy AI Intelligence</h1>
          <p>Read-only listing analysis from synced Etsy data. Reports are local and never write back to Etsy.</p>
        </div>
        <AnalyzeButton />
      </div>

      <section className="grid metrics">
        <div className="metric"><span>Overall Shop Health</span><strong>{health}</strong></div>
        <div className="metric"><span>Average SEO Score</span><strong>{avgSeo}</strong></div>
        <div className="metric"><span>Average Conversion</span><strong>{avgConversion}</strong></div>
        <div className="metric"><span>Needs Attention</span><strong>{needingAttention.length}</strong></div>
      </section>

      <section className="grid three-col" style={{ marginTop: 16 }}>
        <Chart
          title="SEO Distribution"
          buckets={distribution(latestReports.map((report) => report.seoScore), [
            ["0-49", 0, 49],
            ["50-67", 50, 67],
            ["68-81", 68, 81],
            ["82-100", 82, 100]
          ])}
        />
        <Chart
          title="Price Distribution"
          buckets={distribution(priceValues, [
            ["0-29", 0, 29],
            ["30-59", 30, 59],
            ["60-99", 60, 99],
            ["100+", 100, 99999]
          ])}
        />
        <Chart
          title="Inventory Distribution"
          buckets={distribution(inventoryValues, [
            ["0", 0, 0],
            ["1-2", 1, 2],
            ["3-9", 3, 9],
            ["10+", 10, 99999]
          ])}
        />
      </section>

      <section className="grid two-col" style={{ marginTop: 16 }}>
        <div className="panel">
          <h2><TrendingUp size={18} /> Top 10 Opportunities</h2>
          <div className="list">
            {topOpportunities.map((report) => (
              <a className="listing-row" href={`/listings/${report.listing.id}`} key={report.id}>
                <div className="row-head">
                  <strong>{report.listing.title}</strong>
                  <span className="chip">{report.overallPriority}</span>
                </div>
                <div className="chips">
                  <span className={scoreClass(report.seoScore)}>SEO {report.seoScore}</span>
                  <span className={scoreClass(report.conversionScore)}>CVR {report.conversionScore}</span>
                  <span className="chip">{report.riskLevel} risk</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2><AlertTriangle size={18} /> Top 10 Risks</h2>
          <div className="list">
            {topRisks.map((report) => (
              <a className="listing-row" href={`/listings/${report.listing.id}`} key={report.id}>
                <div className="row-head">
                  <strong>{report.listing.title}</strong>
                  <span className="chip">{report.riskLevel}</span>
                </div>
                <div className="chips">
                  <span className={scoreClass(report.imageScore)}>Images {report.imageScore}</span>
                  <span className={scoreClass(report.pricingScore)}>Pricing {report.pricingScore}</span>
                  <span className="chip">{report.overallPriority}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {!latestReports.length ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2><BrainCircuit size={18} /> No AI Reports Yet</h2>
          <p className="muted">Run Analyze to generate local listing intelligence reports from synced Etsy data.</p>
        </section>
      ) : null}
    </>
  );
}
