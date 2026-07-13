# Etsy MDIS API Extraction Summary

- Export timestamp: 2026-07-13T07:38:47.940Z
- Requested coverage: 2026-01-11 through 2026-07-12 inclusive (UTC)
- Shop ID: 25333110
- Mode: read-only
- Write approval: false
- Token refreshed in process memory: true
- Endpoints used: GET /shops/{shop_id}/listings/active; GET /shops/{shop_id}/transactions
- Production API-sync sources used for enrichment: GET /listings/{listing_id}; GET /listings/{listing_id}/inventory
- Listing discovery records: 215
- Search discovery records: 0
- Engagement records: 215
- Order mapping records: 69
- Identifier mappings: 216
- Missing SKU mappings: 0
- Duplicate SKU conflicts: 60
- Unmatched identifiers: 1
- Rate limits encountered: NO
- Last observed daily remaining: 4988
- Last production sync: 2026-07-10T12:05:44.027Z (partial_success)

## API limitations

Etsy Open API v3 does not provide seller analytics endpoints for date-bounded views, visits, impressions, clicks, search queries, traffic-source attribution, favorite event dates, or cart additions. These fields are marked UNKNOWN. Lifetime views are provided only as separately labeled snapshots and must not be interpreted as the requested reporting-period views.

## Privacy

No buyer names, emails, addresses, phone numbers, personal messages, or other unnecessary personal data are included.
