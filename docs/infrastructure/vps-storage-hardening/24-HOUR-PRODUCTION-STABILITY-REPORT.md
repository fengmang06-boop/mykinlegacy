# 24-Hour Production Stability Report

Final classification: **STABLE_WITH_GROWTH_WATCH**.

## Window and sampling

- Gate window: 2026-07-24 17:13 to 2026-07-25 17:13 Asia/Shanghai.
- First valid sample: 2026-07-24 17:20:29 Asia/Shanghai.
- First post-gate sample: 2026-07-25 18:10:09 Asia/Shanghai.
- Expected hourly boundary samples: 25.
- Valid raw samples used across the boundary: 27.
- Unique expected hour buckets represented: 23 of 24.
- Missing local hour bucket: 2026-07-24 21:00 Asia/Shanghai. It is recorded as
  missing and is not treated as zero.
- Scheduled local hourly success rate: 24 of 25 expected executions (96%);
  the missing execution was followed by a successful manual read-only sample.
- Real samples before and after the missing bucket and after the gate deadline
  provide more than 24 hours of elapsed coverage.

## Capacity results

- Minimum root free space: 45,676,716,032 bytes (42.54 GiB).
- Maximum root usage: 41%.
- Root used growth during the gate window: 315,961,344 bytes (301.32 MiB).
- Maximum inode usage: 2%.
- Docker directory growth: 298,635,264 bytes (284.80 MiB).
- MySQL data growth: 4,096 bytes.
- Capacity alerts above INFO: 0.
- Deployment capacity gate: allowed throughout sampled states.

## Service results

- MySQL restart count: 23 to 23; delta 0.
- MySQL uptime at the final in-gate sample: approximately 24 hours 35 minutes.
- MySQL final health: healthy.
- Product API database/5xx errors: 0 in available Nginx evidence.
- Checkout 5xx errors: 0; safe empty request returned 400 and created nothing.
- Page 5xx incidents: 0 in available Nginx evidence.
- Active or stale lock incidents: 0. The zero-byte flock target exists, but it
  has no kernel holder and is not an active deployment lock.
- Current Homepage, Collection, Christmas, `/create`, and Product API: HTTP 200.

## Interpretation

The private-storage volume did not grow during the observation window. The
Docker growth is attributable primarily to the `mykinlegacy_worker` JSON log,
which reached about 519 MB. Production remains healthy and far from capacity
thresholds, but container-log growth requires a seven-day watch and a separately
reviewed rotation policy before any future V2 production publication.

No production page, database business record, order, payment object, index
request, sitemap, Docker image, or private-storage file was changed by closure.
