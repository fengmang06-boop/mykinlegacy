# Analytics Internal Traffic Audit

Status date: 2026-08-29

## Traffic contract

| Traffic type      | Meaning                                                          | Reporting treatment              |
| ----------------- | ---------------------------------------------------------------- | -------------------------------- |
| REAL_VISITOR      | Standard browser with no explicit internal marker                | ESTIMATED_EXTERNAL               |
| OWNER_INTERNAL    | Owner-marked browser                                             | EXCLUDED_INTERNAL                |
| CODEX_QA          | Codex or approved QA browser                                     | EXCLUDED_INTERNAL                |
| AUTOMATED_MONITOR | Monitor, crawler, Lighthouse, Playwright, or headless user agent | EXCLUDED_INTERNAL                |
| DEVELOPMENT       | Localhost or development runtime                                 | EXCLUDED_INTERNAL                |
| UNKNOWN           | Missing, invalid, or unclassified evidence                       | RAW only; never assumed external |

Classification precedence is development runtime, explicit query marker, persisted first-party marker, automated user agent, normal browser, then UNKNOWN. The server revalidates the supplied type and forces recognized automation to AUTOMATED_MONITOR.

## Explicit markers

- Owner: `?mkl_traffic_type=OWNER_INTERNAL`
- Codex QA: `?mkl_traffic_type=CODEX_QA`, `?mkl_qa=codex`, or `?mkl_test=1`
- Monitor: `?mkl_traffic_type=AUTOMATED_MONITOR`

The marker persists for 30 days in a Secure, SameSite=Lax first-party cookie. A tester must use a separate browser profile before normal external validation so the exclusion marker does not contaminate that session.

## Event context

Each post-release event carries anonymous `session_id`, source, medium, landing page, device category, traffic type, traffic reason, and reporting flags. No name, email, questionnaire answer, family detail, or other PII is added.

## IP rule and history rule

IP address is not used as the sole or primary identity rule. The API retains the pre-existing hashed IP signal only for audit/security purposes. Historical sessions are not reclassified because they did not carry the identity contract.
