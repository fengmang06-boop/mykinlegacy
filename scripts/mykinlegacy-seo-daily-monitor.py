"""Read-only daily SEO monitor for the nine MyKinLegacy journal articles.

Credentials remain outside the repository in Windows DPAPI-protected files. This
script never submits a sitemap, requests indexing, or writes to GSC/GA4.
"""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


SITE_ORIGIN = "https://mykinlegacy.com"
SITEMAP_URL = f"{SITE_ORIGIN}/sitemap.xml"
GSC_PROPERTY = "sc-domain:mykinlegacy.com"
GA4_PROPERTY_ID = "545487842"
SECURE_DIR = Path.home() / "AppData/Local/MyKinLegacy/monitoring"
TOKEN_PATH = SECURE_DIR / "oauth-token.dpapi"
CLIENT_PATH = SECURE_DIR / "oauth-client.dpapi"
OUTPUT_DIR = SECURE_DIR / "daily-results"
MILESTONE_PATH = OUTPUT_DIR / "batch-02-milestones.json"
CLIENT_ENTROPY = b"MyKinLegacy Monitoring OAuth Client v1"

STATUS_ZERO = "AVAILABLE_ZERO_ACTIVITY"
STATUS_ACTIVITY = "AVAILABLE_MEANINGFUL_ACTIVITY"
STATUS_UNAVAILABLE = "PROCESSING_OR_UNAVAILABLE"
STATUS_ACCESS = "ACCESS_UNAVAILABLE"
STATUS_ERROR = "API_ERROR"

ARTICLES = (
    ("batch-01", "2026-07-14", "/journal/family-legacy-gift-ideas"),
    ("batch-01", "2026-07-14", "/journal/what-is-a-family-crest"),
    ("batch-01", "2026-07-14", "/journal/retirement-gift-for-father"),
    ("batch-01", "2026-07-14", "/journal/personalized-gifts-for-grandparents"),
    ("batch-01", "2026-07-14", "/journal/how-to-create-a-family-keepsake"),
    ("batch-02", "2026-07-16", "/journal/family-reunion-gift-ideas"),
    ("batch-02", "2026-07-16", "/journal/personalized-anniversary-gifts-for-parents"),
    ("batch-02", "2026-07-16", "/journal/how-to-create-a-modern-family-crest"),
    ("batch-02", "2026-07-16", "/journal/personalized-wedding-gifts-for-couples"),
)


class DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def dpapi_unprotect(data: bytes, entropy: bytes | None = None) -> bytes:
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    source = ctypes.create_string_buffer(data)
    source_blob = DataBlob(len(data), ctypes.cast(source, ctypes.POINTER(ctypes.c_byte)))
    result_blob = DataBlob()
    description = wintypes.LPWSTR()
    entropy_buffer = ctypes.create_string_buffer(entropy) if entropy else None
    entropy_blob = (
        DataBlob(len(entropy), ctypes.cast(entropy_buffer, ctypes.POINTER(ctypes.c_byte)))
        if entropy and entropy_buffer
        else None
    )
    if not crypt32.CryptUnprotectData(
        ctypes.byref(source_blob),
        ctypes.byref(description),
        ctypes.byref(entropy_blob) if entropy_blob else None,
        None,
        None,
        0x1,
        ctypes.byref(result_blob),
    ):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(result_blob.pbData, result_blob.cbData)
    finally:
        if description:
            kernel32.LocalFree(description)
        kernel32.LocalFree(result_blob.pbData)


def load_credentials() -> tuple[str, str, str]:
    token_record = json.loads(dpapi_unprotect(TOKEN_PATH.read_bytes()))
    client_record = json.loads(dpapi_unprotect(CLIENT_PATH.read_bytes(), CLIENT_ENTROPY))
    client = client_record.get("installed") or client_record.get("web") or client_record
    token = token_record.get("token", token_record)
    client_id = token_record.get("client_id") or client.get("client_id")
    client_secret = client.get("client_secret")
    refresh_token = token.get("refresh_token")
    if not client_id or not client_secret or not refresh_token:
        raise RuntimeError("secure OAuth credential record is incomplete")
    return client_id, client_secret, refresh_token


def refresh_access_token() -> str:
    client_id, client_secret, refresh_token = load_credentials()
    request = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=urllib.parse.urlencode(
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            }
        ).encode("ascii"),
        method="POST",
    )
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read())
    access_token = payload.get("access_token")
    if not access_token:
        raise RuntimeError("OAuth refresh returned no access token")
    return access_token


def request_json(url: str, token: str, payload: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Accept", "application/json")
    if data:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        try:
            body = json.loads(error.read())
            reason = body.get("error", {}).get("status") or body.get("error", {}).get("message")
        except Exception:
            reason = "HTTP_ERROR"
        return error.code, {"error": str(reason)[:240]}
    except Exception as error:
        return 0, {"error": type(error).__name__}


def api_status(http_status: int, has_activity: bool | None) -> str:
    if http_status in (401, 403):
        return STATUS_ACCESS
    if http_status == 200:
        if has_activity is None:
            return STATUS_UNAVAILABLE
        return STATUS_ACTIVITY if has_activity else STATUS_ZERO
    if http_status in (0, 404, 409, 429, 500, 502, 503, 504):
        return STATUS_UNAVAILABLE
    return STATUS_ERROR


def fetch_url_status(url: str) -> int:
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "MyKinLegacyReadOnlyMonitor/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception:
        return 0


def fetch_sitemap() -> tuple[int, set[str]]:
    request = urllib.request.Request(SITEMAP_URL, headers={"User-Agent": "MyKinLegacyReadOnlyMonitor/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            status = response.status
        root = ET.fromstring(body)
        urls = {element.text.strip() for element in root.iter() if element.tag.endswith("loc") and element.text}
        return status, urls
    except urllib.error.HTTPError as error:
        return error.code, set()
    except Exception:
        return 0, set()


def gsc_inspection(token: str, url: str) -> dict:
    status, payload = request_json(
        "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        token,
        {"inspectionUrl": url, "siteUrl": GSC_PROPERTY, "languageCode": "en-US"},
    )
    result = payload.get("inspectionResult", {}).get("indexStatusResult", {})
    return {
        "status": api_status(status, bool(result) if status == 200 else None),
        "coverage_state": result.get("coverageState"),
        "indexing_state": result.get("indexingState"),
        "verdict": result.get("verdict"),
        "last_crawl_time": result.get("lastCrawlTime"),
        "http_status": status,
        "error": payload.get("error"),
    }


def gsc_report(token: str, url: str, start: str, end: str, dimensions: list[str]) -> tuple[int, dict]:
    endpoint = (
        "https://www.googleapis.com/webmasters/v3/sites/"
        + urllib.parse.quote(GSC_PROPERTY, safe="")
        + "/searchAnalytics/query"
    )
    return request_json(
        endpoint,
        token,
        {
            "startDate": start,
            "endDate": end,
            "dimensions": dimensions,
            "dimensionFilterGroups": [
                {"filters": [{"dimension": "page", "operator": "equals", "expression": url}]}
            ],
            "rowLimit": 25000,
            "dataState": "all",
        },
    )


def summarize_gsc(token: str, url: str, start: str, end: str) -> dict:
    status, by_date = gsc_report(token, url, start, end, ["date"])
    if status != 200:
        return {
            "status": api_status(status, None),
            "http_status": status,
            "impressions": None,
            "clicks": None,
            "ctr": None,
            "average_position": None,
            "queries": None,
            "countries": None,
            "devices": None,
            "dated_rows": None,
            "error": by_date.get("error"),
        }
    rows = by_date.get("rows", [])
    clicks = sum(float(row.get("clicks", 0)) for row in rows)
    impressions = sum(float(row.get("impressions", 0)) for row in rows)
    position = (
        sum(float(row.get("position", 0)) * float(row.get("impressions", 0)) for row in rows) / impressions
        if impressions
        else 0
    )
    dimensions: dict[str, list[dict]] = {}
    for dimension in ("query", "country", "device"):
        dim_status, dim_payload = gsc_report(token, url, start, end, [dimension])
        dimensions[dimension] = dim_payload.get("rows", [])[:100] if dim_status == 200 else []
    return {
        "status": api_status(status, impressions > 0 or clicks > 0),
        "http_status": status,
        "impressions": int(impressions),
        "clicks": int(clicks),
        "ctr": clicks / impressions if impressions else 0,
        "average_position": position,
        "queries": dimensions["query"],
        "countries": dimensions["country"],
        "devices": dimensions["device"],
        "dated_rows": rows,
        "error": None,
    }


def ga4_report(token: str, start: str, end: str, path: str, dimensions: list[str], metrics: list[str]) -> tuple[int, dict]:
    return request_json(
        f"https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROPERTY_ID}:runReport",
        token,
        {
            "dateRanges": [{"startDate": start, "endDate": end}],
            "dimensions": [{"name": name} for name in dimensions],
            "metrics": [{"name": name} for name in metrics],
            "dimensionFilter": {
                "filter": {
                    "fieldName": "landingPagePlusQueryString",
                    "stringFilter": {"matchType": "BEGINS_WITH", "value": path, "caseSensitive": False},
                }
            },
            "limit": 10000,
        },
    )


def metric_value(row: dict, index: int) -> float:
    try:
        return float(row.get("metricValues", [])[index].get("value", "0"))
    except (IndexError, TypeError, ValueError):
        return 0


def summarize_ga4(token: str, path: str, start: str, end: str) -> dict:
    metric_names = ["activeUsers", "sessions", "engagedSessions", "userEngagementDuration"]
    status, payload = ga4_report(token, start, end, path, ["date"], metric_names)
    if status != 200:
        return {
            "status": api_status(status, None),
            "http_status": status,
            "landing_users": None,
            "sessions": None,
            "engaged_sessions": None,
            "engagement_time_seconds": None,
            "create_started": None,
            "checkout_started": None,
            "purchase_completed": None,
            "dated_rows": None,
            "external_engaged_rows": None,
            "error": payload.get("error"),
        }
    rows = payload.get("rows", [])
    totals = [sum(metric_value(row, index) for row in rows) for index in range(len(metric_names))]
    event_status, event_payload = ga4_report(token, start, end, path, ["date", "eventName"], ["eventCount"])
    event_counts = {"create_started": 0, "checkout_started": 0, "purchase_completed": 0}
    event_rows = event_payload.get("rows", []) if event_status == 200 else []
    for row in event_rows:
        values = row.get("dimensionValues", [])
        event_name = values[1].get("value") if len(values) > 1 else None
        if event_name in event_counts:
            event_counts[event_name] += int(metric_value(row, 0))
    country_status, country_payload = ga4_report(
        token, start, end, path, ["date", "country"], ["engagedSessions"]
    )
    external_rows = []
    if country_status == 200:
        for row in country_payload.get("rows", []):
            values = row.get("dimensionValues", [])
            country = values[1].get("value") if len(values) > 1 else ""
            if country != "Japan" and metric_value(row, 0) > 0:
                external_rows.append(row)
    meaningful = totals[0] > 0 or totals[1] > 0 or any(event_counts.values())
    return {
        "status": api_status(status, meaningful),
        "http_status": status,
        "landing_users": int(totals[0]),
        "sessions": int(totals[1]),
        "engaged_sessions": int(totals[2]),
        "engagement_time_seconds": totals[3],
        **event_counts,
        "dated_rows": rows,
        "event_rows": event_rows,
        "external_engaged_rows": external_rows,
        "internal_traffic_note": "Known Japan monitoring traffic excluded only from external-engagement milestone.",
        "error": event_payload.get("error") if event_status != 200 else None,
    }


def unavailable_gsc() -> dict:
    return {
        "status": STATUS_UNAVAILABLE,
        "http_status": None,
        "impressions": None,
        "clicks": None,
        "ctr": None,
        "average_position": None,
        "queries": None,
        "countries": None,
        "devices": None,
        "dated_rows": None,
        "error": "publication_date_after_measurement_end",
    }


def unavailable_ga4() -> dict:
    return {
        "status": STATUS_UNAVAILABLE,
        "http_status": None,
        "landing_users": None,
        "sessions": None,
        "engaged_sessions": None,
        "engagement_time_seconds": None,
        "create_started": None,
        "checkout_started": None,
        "purchase_completed": None,
        "dated_rows": None,
        "event_rows": None,
        "external_engaged_rows": None,
        "error": "publication_date_after_measurement_end",
    }


def daily_delta(current: dict, previous: dict | None, fields: tuple[str, ...]) -> dict:
    result = {}
    for field in fields:
        value = current.get(field)
        prior = previous.get(field) if previous else None
        result[field] = value - prior if isinstance(value, (int, float)) and isinstance(prior, (int, float)) else None
    return result


def row_date(row: dict) -> str | None:
    values = row.get("keys") or [item.get("value") for item in row.get("dimensionValues", [])]
    if not values:
        return None
    raw = str(values[0])
    return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}" if len(raw) == 8 and raw.isdigit() else raw


def update_milestones(milestones: dict, path: str, gsc: dict, ga4: dict) -> dict:
    current = milestones.setdefault(
        path,
        {
            "publication_date": "2026-07-16",
            "first_impression_date": None,
            "first_query_date": None,
            "first_organic_click_date": None,
            "first_external_engaged_visit": None,
            "first_create_started": None,
            "first_checkout_started": None,
            "first_purchase_completed": None,
        },
    )
    for row in gsc.get("dated_rows") or []:
        observed = row_date(row)
        if row.get("impressions", 0) > 0 and not current["first_impression_date"]:
            current["first_impression_date"] = observed
        if row.get("clicks", 0) > 0 and not current["first_organic_click_date"]:
            current["first_organic_click_date"] = observed
    for row in gsc.get("queries") or []:
        if row.get("impressions", 0) > 0 and not current["first_query_date"]:
            current["first_query_date"] = row_date((gsc.get("dated_rows") or [{}])[0])
    for row in ga4.get("external_engaged_rows") or []:
        if not current["first_external_engaged_visit"]:
            current["first_external_engaged_visit"] = row_date(row)
    event_map = {
        "create_started": "first_create_started",
        "checkout_started": "first_checkout_started",
        "purchase_completed": "first_purchase_completed",
    }
    for row in ga4.get("event_rows") or []:
        values = row.get("dimensionValues", [])
        event = values[1].get("value") if len(values) > 1 else None
        key = event_map.get(event)
        if key and metric_value(row, 0) > 0 and not current[key]:
            current[key] = row_date(row)
    return current


def read_previous(report_date: str) -> dict | None:
    candidates = sorted(path for path in OUTPUT_DIR.glob("????-??-??.json") if path.stem < report_date)
    if not candidates:
        return None
    return json.loads(candidates[-1].read_text(encoding="utf-8"))


def sanitized_article(record: dict) -> dict:
    # Raw API rows contain only aggregate dimensions and metrics, never credentials or PII.
    return record


def run(report_date: date) -> dict:
    token = refresh_access_token()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sitemap_status, sitemap_urls = fetch_sitemap()
    previous = read_previous(report_date.isoformat())
    previous_by_path = {item["path"]: item for item in previous.get("articles", [])} if previous else {}
    milestones = json.loads(MILESTONE_PATH.read_text(encoding="utf-8")) if MILESTONE_PATH.exists() else {}
    data_end = report_date - timedelta(days=1)
    articles = []
    for batch, publication_date, path in ARTICLES:
        url = SITE_ORIGIN + path
        cumulative_start = publication_date
        cumulative_end = data_end.isoformat()
        daily_start = data_end.isoformat()
        inspection = gsc_inspection(token, url)
        gsc_daily = summarize_gsc(token, url, daily_start, daily_start)
        has_cumulative_window = cumulative_start <= cumulative_end
        gsc_cumulative = (
            summarize_gsc(token, url, cumulative_start, cumulative_end)
            if has_cumulative_window
            else unavailable_gsc()
        )
        ga4_daily = summarize_ga4(token, path, daily_start, daily_start)
        ga4_cumulative = (
            summarize_ga4(token, path, cumulative_start, cumulative_end)
            if has_cumulative_window
            else unavailable_ga4()
        )
        prior = previous_by_path.get(path)
        record = {
            "batch": batch,
            "publication_date": publication_date,
            "path": path,
            "url": url,
            "http_status": fetch_url_status(url),
            "sitemap_present": url in sitemap_urls,
            "gsc_indexing": inspection,
            "daily": {"date": daily_start, "gsc": gsc_daily, "ga4": ga4_daily},
            "cumulative_since_publication": {
                "date_range": {"start": cumulative_start, "end": cumulative_end},
                "gsc": gsc_cumulative,
                "ga4": ga4_cumulative,
            },
            "delta_vs_previous_monitor": {
                "gsc": daily_delta(
                    gsc_cumulative,
                    prior.get("cumulative_since_publication", {}).get("gsc") if prior else None,
                    ("impressions", "clicks"),
                ),
                "ga4": daily_delta(
                    ga4_cumulative,
                    prior.get("cumulative_since_publication", {}).get("ga4") if prior else None,
                    (
                        "landing_users",
                        "sessions",
                        "engaged_sessions",
                        "engagement_time_seconds",
                        "create_started",
                        "checkout_started",
                        "purchase_completed",
                    ),
                ),
                "status": "AVAILABLE" if prior else STATUS_UNAVAILABLE,
            },
        }
        if batch == "batch-02":
            record["milestones"] = update_milestones(milestones, path, gsc_cumulative, ga4_cumulative)
        articles.append(sanitized_article(record))
    report = {
        "schema_version": "seo-nine-article-daily-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "report_date": report_date.isoformat(),
        "measurement_end_date": data_end.isoformat(),
        "data_availability_rule": "Unavailable or processing data is null and never converted to zero.",
        "articles_monitored": len(ARTICLES),
        "batch_01_count": sum(1 for batch, _, _ in ARTICLES if batch == "batch-01"),
        "batch_02_count": sum(1 for batch, _, _ in ARTICLES if batch == "batch-02"),
        "sitemap_expected_url_count": 51,
        "sitemap_http_status": sitemap_status,
        "sitemap_observed_url_count": len(sitemap_urls),
        "sitemap_submission_performed": False,
        "indexing_requests_performed": False,
        "manufactured_visits_performed": False,
        "articles": articles,
    }
    output_path = OUTPUT_DIR / f"{report_date.isoformat()}.json"
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "latest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    MILESTONE_PATH.write_text(json.dumps(milestones, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def self_test() -> None:
    assert len(ARTICLES) == 9
    assert sum(1 for item in ARTICLES if item[0] == "batch-01") == 5
    assert sum(1 for item in ARTICLES if item[0] == "batch-02") == 4
    assert len({item[2] for item in ARTICLES}) == 9
    assert api_status(200, False) == STATUS_ZERO
    assert api_status(200, True) == STATUS_ACTIVITY
    assert api_status(403, None) == STATUS_ACCESS
    assert api_status(503, None) == STATUS_UNAVAILABLE
    print("SELF_TEST_PASS articles=9 batch_01=5 batch_02=4")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Monitoring report date in YYYY-MM-DD")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    try:
        report_date = date.fromisoformat(args.date) if args.date else date.today()
        report = run(report_date)
        print(
            "MONITOR_COMPLETE "
            f"date={report['report_date']} articles={report['articles_monitored']} "
            f"sitemap_http={report['sitemap_http_status']}"
        )
        return 0
    except Exception as error:
        print(f"MONITOR_FAILED error={type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
