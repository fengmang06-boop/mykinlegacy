# Content Batch 02 Post-Publish QA

Status: PENDING_DEPLOYMENT

This file will be completed only from the deployed production URLs.

Required checks per article:

- HTTP 200
- H1, title, meta description, canonical, and Open Graph image
- Exactly one Article schema
- Exactly one BreadcrumbList schema
- Zero FAQPage, Product, Review, and Rating schema
- Hero image and alt text
- Internal and external links
- Mobile horizontal overflow
- No placeholder, internal path, Markdown artifact, token, secret, or customer data

Required site checks:

- Sitemap HTTP 200 and contains all four new URLs
- Robots.txt HTTP 200
- `/create` HTTP 200
- Product API HTTP 200, active, USD 49
- Checkout not HTTP 503
- Existing Batch 01 articles remain HTTP 200
- No production incident
- No indexing request and no manual sitemap submission

