"""Read-only, evidence-gated MyKinLegacy organic growth controller.

Consumes the existing daily monitor's combined GSC/GA4 report. It never edits
the website, requests indexing, or treats hidden GSC query rows as zero demand.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


SCORER_VERSION = "organic-opportunity-v1.0"
MONITOR = Path.home() / "AppData/Local/MyKinLegacy/monitoring/daily-results/latest.json"
OUTPUT = Path.home() / "AppData/Local/MyKinLegacy/organic-growth"
CLUSTERS = {
    "FAMILY_REUNION_GIFTS": ("reunion",),
    "FAMILY_CREST_EDUCATION": ("crest", "coat of arms", "herald"),
    "FAMILY_LEGACY": ("legacy", "keepsake", "heritage"),
    "GRANDPARENT_MEMORIES": ("grandparent", "grandmother", "grandfather"),
    "PARENT_OCCASION_GIFTS": ("parents", "father", "mother", "dad", "mom", "anniversary"),
    "SEASONAL_FAMILY_GIFTS": ("christmas", "wedding", "birthday"),
    "PRESERVE_FAMILY_STORIES": ("family history", "family stories", "memories", "interview"),
}
NON_CONTENT_PREFIXES = ("/privacy", "/terms", "/refund-policy", "/disclaimer", "/support", "/checkout", "/payment", "/admin", "/download", "/order-status")


class PageLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: set[str] = set()
        self.canonical: str | None = None
        self.robots: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.hrefs.add(values["href"] or "")
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href")
        if tag == "meta" and values.get("name", "").lower() == "robots":
            self.robots = values.get("content")


def public_crawl() -> dict:
    request = urllib.request.Request("https://mykinlegacy.com/sitemap.xml", headers={"User-Agent": "MyKinLegacyOrganicGrowthAudit/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())
    urls = sorted({node.text.strip().rstrip("/") for node in root.iter() if node.tag.endswith("loc") and node.text
                   and urllib.parse.urlparse(node.text.strip()).netloc == "mykinlegacy.com"})
    inventory = set(urls)

    def visit(url: str) -> tuple[str, dict]:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "MyKinLegacyOrganicGrowthAudit/1.0"})
            with urllib.request.urlopen(request, timeout=25) as response:
                html = response.read().decode("utf-8", errors="replace")
                status = response.status
            parser = PageLinks()
            parser.feed(html)
            links = sorted({urllib.parse.urldefrag(urllib.parse.urljoin(url, href))[0].rstrip("/") or "https://mykinlegacy.com"
                            for href in parser.hrefs if href.startswith(("/", "https://mykinlegacy.com"))})
            links = [link for link in links if link in inventory]
            canonical = parser.canonical.rstrip("/") if parser.canonical else None
            expected = url.rstrip("/")
            return url, {"http_status": status, "canonical": parser.canonical,
                         "self_canonical": canonical == expected, "robots": parser.robots,
                         "indexable": status == 200 and canonical == expected and "noindex" not in (parser.robots or "").lower(),
                         "internal_links": links}
        except Exception as error:
            return url, {"http_status": None, "error": type(error).__name__, "indexable": False, "internal_links": []}

    with ThreadPoolExecutor(max_workers=6) as pool:
        pages = dict(pool.map(visit, urls))
    incoming: dict[str, list[str]] = defaultdict(list)
    for source, detail in pages.items():
        for target in detail["internal_links"]:
            if source != target:
                incoming[target].append(source)
    orphans = [url for url in urls if url != "https://mykinlegacy.com" and not incoming[url]]
    return {"generated_at_utc": datetime.now(timezone.utc).isoformat(), "sitemap_url_count": len(urls),
            "urls": urls, "indexable_url_count": sum(1 for x in pages.values() if x["indexable"]),
            "fetch_error_count": sum(1 for x in pages.values() if x["http_status"] is None),
            "orphan_pages": orphans, "pages": pages,
            "incoming_links": {url: sorted(sources) for url, sources in incoming.items()}}


def period(report: dict, name: str) -> dict:
    return report.get("sitewide", {}).get(name, {})


def rows(p: dict, name: str) -> list[dict]:
    value = p.get("gsc", {}).get(name)
    return value if isinstance(value, list) else []


def metric(row: dict, name: str) -> float:
    return float(row.get(name) or 0)


def path_of(url: str) -> str:
    return urllib.parse.urlparse(url).path or "/"


def cluster_for(query: str) -> str:
    q = query.lower()
    for name, terms in CLUSTERS.items():
        if any(term in q for term in terms):
            return name
    return "OTHER_OBSERVED"


def business_relevance(query: str) -> float:
    q = query.lower()
    if any(x in q for x in ("gift", "keepsake", "personalized", "custom")):
        return 1.0
    if any(x in q for x in ("family", "legacy", "crest", "memories", "history")):
        return 0.7
    return 0.3


def content_match(query: str, page: str) -> float:
    q = set(query.lower().replace("-", " ").split()) - {"a", "the", "for", "and", "of", "to", "what", "is", "how"}
    p = set(path_of(page).lower().replace("-", " ").replace("/", " ").split())
    if not q:
        return 0.0
    return min(1.0, len(q & p) / len(q))


def index_state(inspection: dict | None) -> str:
    if not inspection:
        return "UNKNOWN_NOT_INSPECTED"
    coverage = (inspection.get("coverage_state") or "").lower()
    if inspection.get("verdict") == "PASS" and "indexed" in coverage:
        return "INDEXED"
    if "discovered" in coverage and "not indexed" in coverage:
        return "DISCOVERED_NOT_INDEXED"
    if "crawled" in coverage and "not indexed" in coverage:
        return "CRAWLED_NOT_INDEXED"
    return "OTHER_OR_UNKNOWN"


def classify(impressions: int, clicks: int, position: float, previous_impressions: int) -> str:
    if impressions < 10:
        return "INSUFFICIENT_SAMPLE"
    if impressions >= 30 and clicks >= 2 and 4 <= position <= 20 and previous_impressions >= 10 and impressions >= previous_impressions * 1.25:
        return "WINNER"
    if 4 <= position <= 20:
        if impressions >= 30 and clicks == 0 and position <= 10:
            return "CTR_OPPORTUNITY"
        return "QUICK_WIN"
    if 21 <= position <= 50:
        return "EMERGING"
    if previous_impressions >= 30 and impressions <= previous_impressions * 0.5:
        return "DECLINING_CANDIDATE_NEEDS_SECOND_WINDOW"
    return "INSUFFICIENT_SAMPLE"


def score_pair(row: dict, previous: dict, page_strength: int, cluster_support: int, cannibalized: bool) -> dict:
    query, page = row["keys"][:2]
    impressions = int(metric(row, "impressions"))
    clicks = int(metric(row, "clicks"))
    position = metric(row, "position")
    prev = int(metric(previous, "impressions"))
    relevance = business_relevance(query)
    match = content_match(query, page)
    components = {
        "impressions": min(20, math.log1p(impressions) * 4),
        "position": 18 if 4 <= position <= 20 else (10 if 21 <= position <= 50 else 2),
        "ctr_gap": 8 if impressions >= 30 and clicks == 0 and position <= 10 else 0,
        "recent_growth": 8 if prev and impressions >= prev * 1.5 else 0,
        "query_relevance": 10 if relevance >= 0.7 else 3,
        "business_relevance": 10 * relevance,
        "content_match": 10 * match,
        "existing_page_strength": min(6, math.log1p(page_strength) * 1.5),
        "internal_link_support": 0,  # Only scored after an independently verified crawl.
        "topic_cluster_support": min(5, math.log1p(cluster_support)),
        "cannibalization_risk": -15 if cannibalized else 0,
    }
    status = classify(impressions, clicks, position, prev)
    # Low samples can be listed for observation, never authorized for edits.
    score = round(sum(components.values()), 2)
    return {"query": query, "page": page, "cluster": cluster_for(query), "clicks": clicks,
            "impressions": impressions, "ctr": metric(row, "ctr"), "position": round(position, 2),
            "previous_impressions": prev, "classification": status, "score": score,
            "scorer_version": SCORER_VERSION, "components": {k: round(v, 2) for k, v in components.items()},
            "content_match_proxy": round(match, 2), "production_eligible": False}


def make_report(source: dict, crawl: dict | None = None) -> dict:
    current = period(source, "trailing_28_complete_days")
    previous = period(source, "previous_28_complete_days")
    p7 = period(source, "trailing_7_complete_days")
    p90 = period(source, "trailing_90_days")
    current_pairs = [r for r in rows(current, "query_pages") if len(r.get("keys", [])) >= 2]
    prior_pairs = {(r["keys"][0], r["keys"][1]): r for r in rows(previous, "query_pages") if len(r.get("keys", [])) >= 2}
    page_impressions = {r["keys"][0]: int(metric(r, "impressions")) for r in rows(current, "pages") if r.get("keys")}
    cluster_imp = defaultdict(int)
    for r in current_pairs:
        cluster_imp[cluster_for(r["keys"][0])] += int(metric(r, "impressions"))
    query_pages = defaultdict(set)
    for r in rows(p90, "query_pages"):
        if len(r.get("keys", [])) >= 2 and metric(r, "impressions") >= 3:
            query_pages[r["keys"][0]].add(r["keys"][1])
    cannibalized = {q: sorted(pages) for q, pages in query_pages.items() if len(pages) > 1}
    candidates = [score_pair(r, prior_pairs.get(tuple(r["keys"][:2]), {}),
                             page_impressions.get(r["keys"][1], 0), cluster_imp[cluster_for(r["keys"][0])],
                             r["keys"][0] in cannibalized) for r in current_pairs]
    candidates.sort(key=lambda x: x["score"], reverse=True)
    if crawl:
        for candidate in candidates:
            inlinks = len(crawl.get("incoming_links", {}).get(candidate["page"].rstrip("/"), []))
            support = min(6, math.log1p(inlinks) * 2)
            candidate["components"]["internal_link_support"] = round(support, 2)
            candidate["score"] = round(candidate["score"] + support, 2)
        candidates.sort(key=lambda x: x["score"], reverse=True)
    quick_wins = [c for c in candidates if c["classification"] in ("QUICK_WIN", "CTR_OPPORTUNITY") and c["query"] not in cannibalized]
    emerging = [c for c in candidates if c["classification"] == "EMERGING"]
    potential_gaps = []
    pairs_by_query = defaultdict(list)
    for candidate in candidates:
        pairs_by_query[candidate["query"]].append(candidate)
    for query_row in rows(current, "queries"):
        if not query_row.get("keys") or metric(query_row, "impressions") < 10:
            continue
        query = query_row["keys"][0]
        matches = pairs_by_query.get(query, [])
        if not matches:
            # GSC can hide query-page intersections. This is not a proven gap.
            continue
        best = max(matches, key=lambda c: c["content_match_proxy"])
        if best["content_match_proxy"] < 0.3 and business_relevance(query) >= 0.7:
            potential_gaps.append({"query": query, "impressions": int(metric(query_row, "impressions")),
                                   "best_visible_page": best["page"], "url_token_match_proxy": best["content_match_proxy"],
                                   "status": "POTENTIAL_GAP_REQUIRES_CONTENT_AND_SERP_REVIEW",
                                   "new_page_authorized": False})
    potential_gaps.sort(key=lambda x: x["impressions"], reverse=True)

    clusters = defaultdict(lambda: {"query_set": set(), "page_set": set(), "clicks": 0, "impressions": 0, "weighted_position": 0})
    for r in current_pairs:
        q, page = r["keys"][:2]
        c = clusters[cluster_for(q)]
        c["query_set"].add(q)
        c["page_set"].add(page)
        c["clicks"] += int(metric(r, "clicks"))
        c["impressions"] += int(metric(r, "impressions"))
        c["weighted_position"] += metric(r, "position") * metric(r, "impressions")
    cluster_list = [{"cluster": name, "query_count": len(v["query_set"]), "existing_page_count": len(v["page_set"]),
                     "clicks": v["clicks"], "impressions": v["impressions"],
                     "average_position": round(v["weighted_position"] / v["impressions"], 2) if v["impressions"] else None,
                     "business_relevance": round(max(business_relevance(q) for q in v["query_set"]), 2),
                     "trend": "INSUFFICIENT_QUERY_LEVEL_DATA", "content_gaps": []}
                    for name, v in clusters.items()]
    cluster_list.sort(key=lambda c: c["impressions"], reverse=True)
    previous_cluster_imp = defaultdict(int)
    for row in rows(previous, "query_pages"):
        if row.get("keys"):
            previous_cluster_imp[cluster_for(row["keys"][0])] += int(metric(row, "impressions"))
    for cluster in cluster_list:
        old = previous_cluster_imp[cluster["cluster"]]
        cluster["previous_28d_visible_pair_impressions"] = old
        if old >= 20 and cluster["impressions"] >= 20:
            ratio = cluster["impressions"] / old
            cluster["trend"] = "GROWING_VISIBLE_PAIR_SIGNAL" if ratio >= 1.25 else "DECLINING_VISIBLE_PAIR_SIGNAL" if ratio <= 0.75 else "STABLE_VISIBLE_PAIR_SIGNAL"

    inspected = {}
    for article in source.get("articles", []):
        if article.get("url"):
            inspected[article["url"]] = index_state(article.get("gsc_indexing"))
    for target in source.get("focused_indexing_verification", {}).get("target_evidence", []):
        if target.get("url"):
            inspected[target["url"]] = index_state(target.get("gsc_indexing"))
    states = defaultdict(int)
    for state in inspected.values():
        states[state] += 1
    no_impression = [u for u, state in inspected.items() if u not in page_impressions and state == "INDEXED"
                     and not path_of(u).startswith(NON_CONTENT_PREFIXES)]
    no_impression.sort()
    if crawl:
        observed_paths = {path_of(url) for url in page_impressions}
        no_impression = [url for url in crawl.get("urls", []) if path_of(url) not in observed_paths
                         and not path_of(url).startswith(NON_CONTENT_PREFIXES)]
        no_impression.sort()

    def window_summary(p: dict) -> dict:
        g = p.get("gsc", {})
        return {"date_range": p.get("date_range"), "status": g.get("status"), "clicks": g.get("clicks"),
                "impressions": g.get("impressions"), "ctr": g.get("ctr"), "average_position": g.get("average_position"),
                "visible_queries": len(rows(p, "queries")), "visible_pages": len(rows(p, "pages")),
                "visible_query_page_pairs": len(rows(p, "query_pages"))}
    organic = current.get("ga4", {})
    learning_pages = []
    previous_pages = {r["keys"][0]: r for r in rows(previous, "pages") if r.get("keys")}
    for url, impressions in sorted(page_impressions.items(), key=lambda item: item[1], reverse=True):
        row = next(r for r in rows(current, "pages") if r.get("keys", [None])[0] == url)
        prev = previous_pages.get(url, {})
        clicks = int(metric(row, "clicks"))
        position = metric(row, "position")
        state = "INSUFFICIENT_SAMPLE" if impressions < 10 else ("WINNER" if clicks >= 2 and impressions >= 30 else
                 "EMERGING" if 21 <= position <= 50 else "VALIDATION" if position <= 20 else "EARLY_SIGNAL")
        learning_pages.append({"page": url, "topic_cluster": cluster_for(path_of(url).replace("-", " ")),
                               "impressions_28d": impressions, "previous_impressions_28d": int(metric(prev, "impressions")),
                               "clicks_28d": clicks, "ctr_28d": metric(row, "ctr"), "position_28d": round(position, 2),
                               "index_status": inspected.get(url, "UNKNOWN_NOT_INSPECTED"), "learning_state": state,
                               "organic_sessions": None, "create_started": None, "checkout_started": None, "purchase": None})
    query_positions = defaultdict(int)
    for row in rows(current, "queries"):
        p = metric(row, "position")
        key = "1_3" if p <= 3 else "4_10" if p <= 10 else "11_20" if p <= 20 else "21_50" if p <= 50 else "51_plus"
        query_positions[key] += 1
    return {
        "schema_version": 1, "scorer_version": SCORER_VERSION, "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_path": str(MONITOR), "source_generated_at_utc": source.get("generated_at_utc"),
        "measurement_end_date": source.get("measurement_end_date"),
        "windows": {"last_7_days": window_summary(p7), "last_28_days": window_summary(current),
                    "previous_28_days": window_summary(previous), "last_90_days": window_summary(p90)},
        "indexation": {"sitemap_observed_url_count": source.get("sitemap_observed_url_count"),
                       "inspected_url_count": len(inspected), "inspected_state_counts": dict(states),
                       "indexable_pages_total": crawl.get("indexable_url_count") if crawl else "NOT_VERIFIED_SITEWIDE",
                       "uninspected_sitemap_urls": max(0, len(crawl["urls"]) - len(inspected)) if crawl else "UNKNOWN",
                       "no_visible_impression_pages": no_impression,
                       "no_visible_impression_is_not_zero_actual_demand": True},
        "internal_link_graph": {"orphan_pages": crawl.get("orphan_pages") if crawl else "NOT_CRAWLED",
                                "crawl_generated_at_utc": crawl.get("generated_at_utc") if crawl else None},
        "top_10_quick_wins": quick_wins[:10], "top_10_content_gaps": [],
        "potential_content_gaps_needing_review": potential_gaps[:10],
        "top_5_topic_clusters": cluster_list[:5], "all_clusters": cluster_list,
        "emerging_observation": emerging[:10], "cannibalization": cannibalized,
        "all_classified_pairs": candidates, "learning_pages": learning_pages,
        "dashboard": {"total_28d_impressions": current.get("gsc", {}).get("impressions"),
                      "total_28d_clicks": current.get("gsc", {}).get("clicks"),
                      "organic_sessions": None, "ga4_sitewide_sessions": organic.get("sessions"),
                      "organic_sessions_attribution": "NOT_PROVEN; GA4 SITEWIDE VALUE ONLY",
                      "visible_ranking_queries": len(rows(current, "queries")),
                      "visible_query_position_bands": dict(query_positions),
                      "indexed_content_pages_inspected": states.get("INDEXED", 0),
                      "new_pages_gaining_impressions": "NOT_VERIFIED",
                      "funnel_sitewide": {k: organic.get(k) for k in ("create_started", "questionnaire_completed", "checkout_started", "purchase_completed")},
                      "funnel_organic_attribution": "NOT_VERIFIED"},
        "first_batch": [], "production_modified": False,
        "decision": "HOLD_INSUFFICIENT_QUERY_PAGE_EVIDENCE",
        "next_check": "NEXT_DAILY_GSC_EXPORT; REVIEW_AGAIN_ON_NEW_COMPLETE_DATE",
        "limitations": ["GSC anonymizes some query and query+page data; row sums are not sitewide totals.",
                        "Zero impressions in visible rows is not proof of zero actual search activity.",
                        "Index coverage is only for inspected URLs, not the entire sitemap.",
                        "GA4 sitewide funnel cannot be claimed as organic without reliable attribution."],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=MONITOR)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--crawl", action="store_true", help="Refresh the public sitemap and internal-link graph")
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding="utf-8"))
    if source.get("source_status", {}).get("gsc") != "SUCCESS":
        raise SystemExit("GSC source is not successful; refusing an evidence-free decision")
    args.output.mkdir(parents=True, exist_ok=True)
    crawl_path = args.output / "crawl-latest.json"
    crawl = public_crawl() if args.crawl else json.loads(crawl_path.read_text(encoding="utf-8")) if crawl_path.exists() else None
    if args.crawl:
        crawl_path.write_text(json.dumps(crawl, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    report = make_report(source, crawl)
    latest = args.output / "latest.json"
    dated = args.output / f"{source['report_date']}.json"
    rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    dated.write_text(rendered, encoding="utf-8")
    latest.write_text(rendered, encoding="utf-8")
    ledger_path = args.output / "growth-ledger.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8")) if ledger_path.exists() else {
        "schema_version": 1, "baseline_date": source["report_date"], "scorer_version": SCORER_VERSION,
        "daily_snapshots": [], "production_actions": []}
    snapshot = {"report_date": source["report_date"], "measurement_end_date": report["measurement_end_date"],
                "report_path": str(dated), "gsc_28d": report["windows"]["last_28_days"],
                "gsc_7d": report["windows"]["last_7_days"], "decision": report["decision"]}
    ledger["daily_snapshots"] = [item for item in ledger["daily_snapshots"] if item["report_date"] != source["report_date"]] + [snapshot]
    ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["decision"], "report": str(latest), "measurement_end_date": report["measurement_end_date"],
                      "quick_wins": len(report["top_10_quick_wins"]), "content_gaps": len(report["top_10_content_gaps"]),
                      "first_batch": len(report["first_batch"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
