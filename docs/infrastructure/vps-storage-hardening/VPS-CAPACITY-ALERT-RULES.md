# VPS Capacity Alert Rules

| Level | Trigger |
| --- | --- |
| INFO | disk below 70%, free above 30 GB, inode below 70% |
| WARNING | disk at least 75%, free below 25 GB, inode at least 75%, or 24-hour growth above 5 GB |
| HIGH | disk at least 85%, free below 15 GB, inode at least 85%, or abnormal Docker growth |
| CRITICAL | disk at least 92%, free below 8 GB, inode at least 92%, disk-related MySQL restart, or database-related Product API 5xx |

The monitor reads root bytes/inodes, Docker and MySQL size/health, journal and
Nginx logs, the production lock, largest path, and service health. CRITICAL
returns exit 92, records evidence, blocks deployment, and never performs a
global prune. Current sample: INFO, 40% used, 42.83 GiB free, inode 2%.

