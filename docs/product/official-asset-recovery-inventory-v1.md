# Official Asset Recovery Inventory v1

## Purpose

Recover previously Founder/CSO-approved MyKinLegacy visual assets and connect them to customer-facing deliverables without regenerating, redesigning, or changing the fulfillment architecture.

## Production Comparison

Before this recovery, production PNG deliverables could fall back to `createMvpCrestPngBuffer()`, a deterministic pixel-buffer renderer marked as a symbolic template. That path produced serviceable but legacy-looking crest artwork and did not use the previously approved crest concept images.

After this recovery, the main customer-facing crest PNG deliverables load recovered approved PNG assets from `packages/storage/assets/official/` before falling back to the deterministic renderer.

Strict full-production status: **NO**.

Reason: the main crest PNG outputs now use approved assets, but no approved transparent crest PNG, standalone certificate frame/background, or standalone PDF ornament assets were found. Those surfaces cannot honestly be marked fully official-asset complete.

## Recovered Approved Crest Assets

| Asset | Source path | Production path | Approval status | Connected usage |
| --- | --- | --- | --- | --- |
| `01a-classic-shield-legacy.png` | `apps/web/public/review/crest-genome-directions-v2/images/01a-classic-shield-legacy.png` | `packages/storage/assets/official/01a-classic-shield-legacy.png` | Founder/CSO approved primary production direction | `crest_variant_1_png` |
| `03a-gothic-memory-lantern.png` | `apps/web/public/review/crest-genome-directions-v2/images/03a-gothic-memory-lantern.png` | `packages/storage/assets/official/03a-gothic-memory-lantern.png` | Founder/CSO approved secondary direction | `crest_variant_2_png` |
| `05a-compass-journey-medallion.png` | `apps/web/public/review/crest-genome-directions-v2/images/05a-compass-journey-medallion.png` | `packages/storage/assets/official/05a-compass-journey-medallion.png` | Founder/CSO approved secondary direction | `crest_variant_3_png` |
| `08a-mountain-resilience-path.png` | `apps/web/public/review/crest-genome-directions-v2/images/08a-mountain-resilience-path.png` | `packages/storage/assets/official/08a-mountain-resilience-path.png` | Founder/CSO approved secondary direction | Recovered and available; not connected to a current PNG deliverable code yet |

## Existing Approved Website Asset Pack

The final homepage/brand asset pack is already present under `apps/web/public/assets/final-homepage/`. It contains brand, hero, occasion, feature, step, generation, trust, CTA, and texture assets. These assets are approved for website presentation, not order artifact generation.

Inventory summary:

| Category | Count / status |
| --- | --- |
| Brand assets | Present under `01_brand/` |
| Homepage hero assets | Present under `02_homepage/hero/` |
| Occasion assets | Present under `03_homepage/occasions/` |
| Feature assets | Present under `04_homepage/features/` |
| Step assets | Present under `05_homepage/steps/` |
| Generations assets | Present under `06_homepage/generations/` |
| Trust assets | Present under `07_homepage/trust/` |
| CTA assets | Present under `08_homepage/cta/` |
| Extra archive assets | Present under `09_extras/` |
| Total files found | 41 |

## Production Connections

| Surface | Current connection |
| --- | --- |
| Vault artifact downloads | Uses stored generated assets; new crest assets are used when order artifacts are generated or repaired after this recovery. |
| PNG output | `crest_variant_1_png`, `crest_variant_2_png`, and `crest_variant_3_png` now load recovered official PNG assets. |
| ZIP package | Inherits the recovered official PNG bodies because ZIP generation packages the materialized artifact bodies. |
| Certificate / PDF | No separate approved certificate frame/background asset was found. Existing PDF text/layout generation remains unchanged. |
| Preview pages | Existing review pages remain unchanged; recovered production assets are listed here and embedded in the storage package for fulfillment. |

## Known Legacy / Placeholder Risk Remaining

| Surface | Current behavior | Why not fixed in this sprint |
| --- | --- | --- |
| `transparent_crest_png` | Still uses existing local renderer fallback. | No Founder-approved transparent PNG asset was found. Reusing an opaque crest as "transparent" would be dishonest and would change the deliverable. |
| Certificate visual frame/background | Existing PDF generation remains layout/text based. | No approved standalone certificate frame/background asset was found in the searched asset folders. |
| Symbol Guide / PDF ornaments | Existing PDF generation remains layout/text based. | No approved standalone PDF ornament package was found beyond website/review visuals. |
| Existing completed orders | Existing artifact files remain unchanged until repair or fresh generation. | The sprint connected production references without rewriting historical customer artifacts automatically. |

## Still Missing

| Missing asset | Reason |
| --- | --- |
| Official transparent crest PNG | No Founder-approved transparent PNG variant was found. `transparent_crest_png` remains on the existing fallback renderer. |
| Official standalone certificate frame/background | No approved standalone production certificate frame/background asset was found in the searched asset folders. |
| Official standalone PDF ornaments | No approved standalone PDF ornament asset was found beyond website/review visuals. |

## Safety Notes

- No image generation was performed.
- No new artwork was created.
- The deterministic renderer remains as a fallback only.
- Existing completed customer orders are not automatically rewritten; they need artifact repair or a fresh generation run to receive the recovered official assets.

## Final Status

Production now uses approved assets for the three main crest PNG deliverables: **YES**.

Production now uses approved assets across every customer-facing download with no placeholder or legacy fallback remaining: **NO**.
