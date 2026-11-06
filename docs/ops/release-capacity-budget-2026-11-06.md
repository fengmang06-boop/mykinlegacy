# MyKinLegacy release capacity budget — 2026-11-06

This is the versioned evidence for `deployment/release-capacity-budget.env`. It applies to the production VPS root filesystem and the release stages that occur there. The application image is built on a GitHub Actions runner, not on the VPS.

## Budget components

| Component | Bytes | Classification | Evidence and coverage |
|---|---:|---|---|
| Extra VPS release peak | 5,268,000,000 | `ESTIMATED_UPPER_BOUND` minimum | Twice the 2,634,000,000-byte unique size reported for the current production image. It covers one candidate image's registry content plus its unpacked snapshot and temporary writable-layer overhead while current and rollback images remain present. It does not include CI compilation because compilation occurs off the VPS. |
| Background growth | 1,073,741,824 | Conservative operational allowance | After cleanup, free space declined from 24,960,507,904 bytes at 2026-11-05T04:10:16Z to 24,802,123,776 bytes at 2026-11-06T00:10:16Z: 158,384,128 bytes in 20 hours. The 1 GiB allowance is about 6.78 times that observed 20-hour decline and covers normal log/runtime growth around a release window. |
| Uncertainty and stop/recovery margin | 2,147,483,648 | Engineering contingency | Covers measurement drift, migration/writable-layer/log variance, an orderly stop, and recovery activity not represented by the candidate image measurement. It is intentionally not reduced to make a release pass. |

Fixed post-budget floor: 16,106,127,360 bytes (15 GiB).

Static pre-build requirement:

`16,106,127,360 + 5,268,000,000 + 1,073,741,824 + 2,147,483,648 = 24,595,352,832 bytes`.

## Candidate-specific rule

The pre-build read-only check uses the static conservative peak. A full release then measures the candidate image's unpacked size on the GitHub Actions runner. Before any VPS repository update or image pull, the Gate uses:

`effective_peak = max(5,268,000,000, 2 × candidate_unpacked_bytes)`.

If the candidate size is missing or invalid, the release is rejected. This makes a Gate result specific to the current candidate rather than a permanent YES. The measurement occurs only during a genuinely authorized full release; `preflight_only` does not build or pull an image.

## Validity and recalibration

- Budget version: `mykinlegacy-vps-release-budget-2026-11-06-v1`.
- Review timestamp: 2026-11-06T00:00:00Z.
- Maximum age: 2,592,000 seconds (30 days); stale or malformed budgets fail closed.
- The next genuine authorized production release must record actual VPS before/pull/switch/post free bytes. That observation may calibrate the peak budget but cannot retroactively justify this release.
- Re-review earlier if the Dockerfile, runtime dependencies, storage backend, release stages, rollback policy, or image size changes materially.
