# Product API Post-Fix QA

Status: pending final production deployment verification.

Required checks:

- [ ] Product API HTTP 200
- [ ] Product status active
- [ ] Price USD $49
- [ ] `image_count` absent from public response
- [ ] `generation_candidate_count = 3`
- [ ] `customer_deliverables.final_crest_count = 1`
- [ ] all five customer deliverable counts equal 1
- [ ] invalid checkout probe returns HTTP 400 and creates no order/session
- [ ] unit tests pass
- [ ] typecheck passes
- [ ] build passes
- [ ] lint passes
- [ ] nine article URLs return 200
- [ ] sitemap returns 200 and includes all nine articles
- [ ] ZIP/Vault/download regression tests pass
- [ ] no token, secret, PII, indexing request, sitemap submission, or production incident
