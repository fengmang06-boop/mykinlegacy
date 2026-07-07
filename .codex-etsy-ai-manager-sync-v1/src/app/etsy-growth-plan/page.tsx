import { ClipboardList, ImagePlus, LineChart, Tags, TrendingUp } from "lucide-react";
import { GROWTH_PLAN_PRODUCT_ORDER, getGrowthPlanDashboard, parsePlanList } from "@/lib/etsy-growth-plan";

export const dynamic = "force-dynamic";

function scoreClass(score: number) {
  if (score >= 82) return "score good";
  if (score >= 68) return "score warn";
  return "score bad";
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function delta(current: number, baseline: number): string {
  const change = Math.round((current - baseline) * 100) / 100;
  if (change === 0) return "0";
  return change > 0 ? `+${change}` : String(change);
}

function trackingForDay(
  baselineDate: string | undefined,
  day: number,
  trackings: Array<{ trackingDate: string; views: number; favorites: number; orders: number; revenue: number; conversionRate: number }>
) {
  if (!baselineDate) return null;
  const targetDate = addDays(baselineDate, day);
  return trackings.find((tracking) => tracking.trackingDate === targetDate) ?? null;
}

export default async function EtsyGrowthPlanPage() {
  const plans = await getGrowthPlanDashboard();
  const sortedPlans = [...plans].sort(
    (a, b) => GROWTH_PLAN_PRODUCT_ORDER.indexOf(a.productName) - GROWTH_PLAN_PRODUCT_ORDER.indexOf(b.productName)
  );
  const withBaseline = sortedPlans.filter((plan) => plan.baseline).length;
  const avgOpportunity = Math.round(
    sortedPlans.reduce((sum, plan) => sum + (plan.listing.aiReports[0]?.opportunityScore ?? 0), 0) / Math.max(sortedPlans.length, 1)
  );
  const totalOrders = sortedPlans.reduce((sum, plan) => sum + (plan.baseline?.orders ?? 0), 0);
  const totalRevenue = Math.round(sortedPlans.reduce((sum, plan) => sum + (plan.baseline?.revenue ?? 0), 0) * 100) / 100;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Etsy Growth Plan</h1>
          <p>Read-only phase 1 traffic plan. Draft changes are local, explainable, and require human review before Etsy edits.</p>
        </div>
      </div>

      <section className="grid metrics">
        <div className="metric"><span>Phase 1 Products</span><strong>{sortedPlans.length}</strong></div>
        <div className="metric"><span>Baseline Saved</span><strong>{withBaseline}</strong></div>
        <div className="metric"><span>Avg Opportunity</span><strong>{avgOpportunity}</strong></div>
        <div className="metric"><span>Baseline Orders / Revenue</span><strong className="compact-value">{totalOrders} / ${totalRevenue}</strong></div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2><LineChart size={18} /> Daily Tracking</h2>
        <div className="chart-list">
          {sortedPlans.map((plan) => {
            const baseline = plan.baseline;
            const day1 = trackingForDay(baseline?.baselineDate, 1, plan.dailyTrackings);
            const day3 = trackingForDay(baseline?.baselineDate, 3, plan.dailyTrackings);
            const day7 = trackingForDay(baseline?.baselineDate, 7, plan.dailyTrackings);
            const day14 = trackingForDay(baseline?.baselineDate, 14, plan.dailyTrackings);
            const checkpoints: Array<[
              string,
              { trackingDate: string; views: number; favorites: number; orders: number; revenue: number; conversionRate: number } | null
            ]> = [["D1", day1], ["D3", day3], ["D7", day7], ["D14", day14]];
            return (
              <div className="listing-row" key={plan.id}>
                <div className="row-head">
                  <strong>{plan.productName}</strong>
                  <span className="chip">{baseline?.baselineDate ?? "No baseline"}</span>
                </div>
                <div className="chips">
                  <span className="chip">Views {baseline?.views ?? 0}</span>
                  <span className="chip">Favorites {baseline?.favorites ?? 0}</span>
                  <span className="chip">Orders {baseline?.orders ?? 0}</span>
                  <span className="chip">CVR {baseline?.conversionRate ?? 0}%</span>
                  <span className="chip">Revenue ${baseline?.revenue ?? 0}</span>
                </div>
                <div className="chips">
                  {checkpoints.map(([label, tracking]) => (
                    <span className="chip" key={String(label)}>
                      {String(label)} {tracking && baseline ? `V ${delta(tracking.views, baseline.views)} / F ${delta(tracking.favorites, baseline.favorites)} / O ${delta(tracking.orders, baseline.orders)}` : "waiting"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="list" style={{ marginTop: 16 }}>
        {sortedPlans.map((plan, index) => {
          const report = plan.listing.aiReports[0];
          const issues = parsePlanList(plan.currentIssues);
          const tags = parsePlanList(plan.proposedTags);
          const images = parsePlanList(plan.imageRecommendations);
          return (
            <article className="panel" key={plan.id}>
              <div className="row-head">
                <div>
                  <h2><TrendingUp size={18} /> #{index + 1} {plan.productName}</h2>
                  <p className="muted">{plan.currentTitle}</p>
                </div>
                <span className="chip">{plan.priority}</span>
              </div>

              <div className="chips" style={{ marginBottom: 14 }}>
                <span className={scoreClass(report?.seoScore ?? 0)}>SEO {report?.seoScore ?? 0}</span>
                <span className={scoreClass(report?.titleScore ?? 0)}>Title {report?.titleScore ?? 0}</span>
                <span className={scoreClass(report?.tagScore ?? 0)}>Tags {report?.tagScore ?? 0}</span>
                <span className={scoreClass(report?.imageScore ?? 0)}>Images {report?.imageScore ?? 0}</span>
                <span className={scoreClass(report?.conversionScore ?? 0)}>CVR {report?.conversionScore ?? 0}</span>
                <span className={scoreClass(report?.opportunityScore ?? 0)}>Opp {report?.opportunityScore ?? 0}</span>
              </div>

              <div className="detail-grid">
                <div>
                  <h3><ClipboardList size={17} /> Current Problems</h3>
                  <ul className="plain-list">
                    {issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                  <p className="muted">{plan.trafficImpactReason}</p>
                </div>
                <div>
                  <h3>Expected Impact</h3>
                  <p>{plan.expectedImpact}</p>
                  <p className="muted">Status: {plan.status}. Draft only; nothing is sent back to Etsy.</p>
                </div>
              </div>

              <div className="detail-grid" style={{ marginTop: 14 }}>
                <div>
                  <h3>Title Draft</h3>
                  <pre>{plan.proposedTitle}</pre>
                </div>
                <div>
                  <h3><Tags size={17} /> 13 Tag Drafts</h3>
                  <div className="chips">
                    {tags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <h3><ImagePlus size={17} /> Image Reinforcement</h3>
                <ul className="plain-list">
                  {images.map((image) => <li key={image}>{image}</li>)}
                </ul>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
