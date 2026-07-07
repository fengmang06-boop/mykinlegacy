# Official Asset Recovery Inventory v1

## Purpose

Recover previously Founder/CSO-approved MyKinLegacy visual assets and connect them to customer-facing deliverables without regenerating, redesigning, or changing the fulfillment architecture.

## Production Comparison

Before this recovery, production PNG deliverables could fall back to `createMvpCrestPngBuffer()`, a deterministic pixel-buffer renderer marked as a symbolic template. That path produced serviceable but legacy-looking crest artwork and did not use the previously approved crest concept images.

After this recovery, the main customer-facing crest PNG deliverables load recovered approved PNG assets from `packages/storage/assets/official/` before falling back to the deterministic renderer.

## Recovered Approved Crest Assets

| Asset | Source path | Production path | Approval status | Connected usage |
| --- | --- | --- | --- | --- |
| `01a-classic-shield-legacy.png` | `apps/web/public/review/crest-genome-directions-v2/images/01a-classic-shield-legacy.png` | `packages/storage/assets/official/01a-classic-shield-legacy.png` | Founder/CSO approved primary production direction | `crest_variant_1_png` |
| `03a-gothic-memory-lantern.png` | `apps/web/public/review/crest-genome-directions-v2/images/03a-gothic-memory-lantern.png` | `packages/storage/assets/official/03a-gothic-memory-lantern.png` | Founder/CSO approved secondary direction | `crest_variant_2_png` |
| `05a-compass-journey-medallion.png` | `apps/web/public/review/crest-genome-directions-v2/images/05a-compass-journey-medallion.png` | `packages/storage/assets/official/05a-compass-journey-medallion.png` | Founder/CSO approved secondary direction | `crest_variant_3_png` |
| `08a-mountain-resilience-path.png` | `apps/web/public/review/crest-genome-directions-v2/images/08a-mountain-resilience-path.png` | `packages/storage/assets/official/08a-mountain-resilience-path.png` | Founder/CSO approved secondary direction | Recovered and available; not connected to a current PNG deliverable code yet |

## Existing Approved Website Asset Pack

The final homepage/brand asset pack is already present under `apps/web/public/assets/final-homepage/`. It contains brand, hero, occasion, feature, step, generation, trust, CTA, and texture assets. These assets are approved for website presentation, not order artifact generation.

## Production Connections

| Surface | Current connection |
| --- | --- |
| Vault artifact downloads | Uses stored generated assets; new crest assets are used when order artifacts are generated or repaired after this recovery. |
| PNG output | `crest_variant_1_png`, `crest_variant_2_png`, and `crest_variant_3_png` now load recovered official PNG assets. |
| ZIP package | Inherits the recovered official PNG bodies because ZIP generation packages the materialized artifact bodies. |
| Certificate / PDF | No separate approved certificate frame/background asset was found. Existing PDF text/layout generation remains unchanged. |
| Preview pages | Existing review pages remain unchanged; recovered production assets are listed here and embedded in the storage package for fulfillment. |

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
