# MENSSKULL Etsy AI Manager MVP

MENSSKULL Etsy AI Manager is a local web tool built on top of `mc-etsy-growth-os`. It turns the Markdown skill system into a working dashboard with a local SQLite database, mock Etsy sync, listing scoring, keyword intelligence, recommendations, approval workflow, and promotion planning.

## Growth Constitution

All Growth OS development is governed by:

```text
docs/growth/MENSSKULL_GROWTH_CONSTITUTION.md
```

This Constitution is the highest standard for every Growth module. Before adding or changing any Growth feature, confirm it remains read-only by default, requires manual approval, keeps version history, supports rollback, includes evidence, and includes risk assessment.

Important optimization decisions must be recorded in:

```text
docs/growth/GROWTH_JOURNAL.md
```

Image work must use the draft-only workflow:

```text
growth/image-queue/
growth/generated-images/
growth/image-prompts/
```

Gemini-ready prompt drafts live in:

```text
growth/image-prompts/templates/
```

## Start The Tool

Install dependencies from this app folder:

```bash
npm install
```

Import mock Etsy data:

```bash
npm run mock:sync
```

Start the local dashboard:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Mock Data

Mock listings live in:

```text
data/mock-etsy-listings.json
```

The MVP imports five MENSSKULL sample products:

* Sterling Silver Skull Ring
* Bull Terrier Ring
* Gothic Key Pendant
* Skull Bracelet
* Snake Ring

## Dashboard

The dashboard shows:

* Shop Health Score
* Total Listings
* Listings Need Optimization
* Top Bestseller Opportunities
* Listings To Kill/Pause
* Top Opportunity Listings
* Weak Listings
* Keyword Opportunities
* Image/Thumbnail Problems
* Conversion Problems
* Promotion Tasks
* Competitor Gaps
* Export Package Quick Entry

## Generate Recommendations

Run:

```bash
npm run analyze:listings
```

The engine scores listings and prints recommendation counts. `npm run mock:sync` also generates local recommendations and approval queue items.

## Approve Recommendations

Open:

```text
http://localhost:3000/recommendations
```

You can approve, reject, or mark recommendations as needs edit. Approval only changes local database state. It does not call Etsy.

## Competitor Comparison

Open:

```text
http://localhost:3000/competitors
```

Manually enter competitor title, price, tags, description, review count, and image notes. The MVP creates a local comparison report and stores a `CompetitorSnapshot`.

## Promotion Calendar

Open:

```text
http://localhost:3000/promotion-calendar
```

The calendar shows the next 30 days of Pinterest, Instagram, Facebook, Etsy coupon, and blog support tasks generated from local mock listings.

## Export Optimization Package

Open any listing detail page and click `Export Etsy Optimization Package`.

The app writes:

```text
exports/{listing-slug}-etsy-optimization-package.md
```

The package includes current listing data, scores, bestseller potential, keyword suggestions, rewrite recommendations, image fix plan, conversion fixes, promotion plan, and approval status.

## Opportunity Radar

Open:

```text
http://localhost:3000/opportunity-radar
```

The v1.6 Opportunity Radar is offline-first. It does not use live web data. It reads current local listings, keyword bank, knowledge files, listing scores, bestseller scores, recommendations, and promotion tasks to answer:

* Which listings should be optimized today
* Which products should be developed next
* Which promotions should be done today
* Which keywords deserve attention
* Which products should be paused or deprioritized

The dashboard first screen now shows `TODAY'S OPPORTUNITIES`, and `OpportunityHistory` saves the daily top opportunities and top actions for future comparison.

## Winning Product Lab

Open:

```text
http://localhost:3000/winning-product-lab
```

The v1.7 Winning Product Lab helps MENSSKULL judge product ideas before design, prototyping, casting, photography, and Etsy launch. It is offline-first and uses MENSSKULL knowledge, keyword bank logic, Opportunity Radar patterns, listing score assumptions, and brand rules.

It includes:

* Product Validator
* Collection Builder
* Market Gap Finder
* Investment Calculator
* Winning Score Engine
* Launch Checklist
* Winning Product History

Each validation exports:

```text
exports/winning-product-report.md
```

The first version does not use Etsy live data, Google Trends, Pinterest, or Reddit. Future versions can connect those data sources after the local scoring model is stable.

## Why The MVP Does Not Connect To Etsy API

v1.3 and v1.4 were intentionally local-only:

* No live Etsy token
* No auto-publish
* No live listing edits
* No inventory changes
* No write operation without approval
* Every future write must have before/after snapshots and logs

This protects MENSSKULL purchase functionality and prevents accidental live listing changes while the analysis and approval workflow is still being tested.

## Etsy API Read-Only Integration

v1.5 adds Etsy Open API v3 read-only structure. It can read real shop data when you configure OAuth tokens, but it still cannot write, publish, or edit live listings.

### Create An Etsy Developer App

1. Open the Etsy Developer portal and create an app for MENSSKULL.
2. Copy the app keystring as `ETSY_CLIENT_ID`.
3. Keep the app secret private as `ETSY_CLIENT_SECRET` if Etsy shows one for your app.
4. Add this Redirect URI in the Etsy app settings:

```text
https://tools.mensskull.com/api/etsy/callback
```

Etsy callback URLs must use a real HTTPS domain. Do not use a localhost callback URL in the Etsy Developer App.

### Configure `.env.local`

Create `apps/etsy-ai-manager/.env.local` and add:

```bash
DATABASE_URL="file:./dev.db"
ETSY_CLIENT_ID=your_keystring
ETSY_CLIENT_SECRET=your_secret_if_available
ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback
ETSY_USER_ID=
ETSY_SHOP_ID=
ETSY_ACCESS_TOKEN=
ETSY_REFRESH_TOKEN=
ETSY_READ_ONLY_MODE=true
```

`ETSY_USER_ID` and `ETSY_SHOP_ID` are auto-detected from Etsy `getMe` after OAuth. Leave them blank unless you intentionally need to override the detected shop.

Never commit `.env.local`.

### Start OAuth

Start the app:

```bash
npm run dev
```

Open:

```text
https://tools.mensskull.com/api/etsy/auth/start
```

After Etsy redirects back, the callback calls Etsy `getMe` and shows the connected `user_id`, `shop_id`, and shop name. Copy the returned `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, `ETSY_USER_ID`, and `ETSY_SHOP_ID` into `.env.local` if they are shown. If `ETSY_SHOP_ID` is left blank, sync will auto-detect it from `getMe`.

You can also open the guided connection page:

```text
http://localhost:3000/etsy-connection
```

It shows API mode, missing env fields, token presence, token expiry status when `ETSY_TOKEN_EXPIRES_AT` is set, connected shop, shop name, shop ID, last read-only sync, sync status, and read-only safety guard state.

Check env from the terminal:

```bash
npm run etsy:check-env
```

### Run Read-Only Sync

```bash
npm run etsy:sync:read-only
```

If env values are missing, the command prints a clear checklist of missing keys.

### Confirm Data Imported

Open the dashboard:

```text
http://localhost:3000
```

Check:

* API Mode
* Last Sync Time
* Listings Pulled
* Sync Errors
* Read-Only Safety

Real Etsy data is imported into the local database and then analyzed by the same local scoring, keyword, recommendation, approval, bestseller, and promotion engines.

### Why v1.5 Does Not Allow Writes

MENSSKULL purchase functionality and live listing integrity matter more than automation speed. v1.5 proves safe read-only ingestion first. All optimization ideas still go to the local recommendation and approval queue. v1.6 can consider approval-gated draft writes later.

## Future Etsy API Integration

The placeholder integration lives in:

```text
src/lib/integrations/etsy/
```

Future live API work should add draft-only write actions behind `ApprovalQueue`, then logged and reversible live updates. Every live write must remain approval-gated.

## Available Scripts

```bash
npm run dev
npm run build
npm run mock:sync
npm run etsy:sync:read-only
npm run etsy:check-env
npm run analyze:listings
npm run test
```
