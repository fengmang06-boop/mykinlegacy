# VPS Storage Baseline

Captured 2026-07-24 on production in `Etc/UTC`, before any cleanup.

| Metric | Baseline |
| --- | ---: |
| Root filesystem | 79,941,234,688 bytes |
| Used | 30,454,669,312 bytes |
| Free | 45,989,163,008 bytes |
| Usage | 40% |
| Inodes | 293,376 / 20,708,160 (2%) |
| `/var/lib/docker` | 7,359,799,296 bytes |
| Project directory | 4,084,006,912 bytes |
| Releases directory | not present |
| systemd journal | 83,935,232 bytes |
| `/var/log` | 169,082,880 bytes |
| `/tmp` | 15,036,416 bytes |
| MySQL volume | 611,459,072 bytes |
| MySQL binlogs | 213,430,605 bytes |
| InnoDB redo | 104,857,600 bytes |
| InnoDB data | 45,088,768 bytes |
| Docker volumes | 7,340,736,512 bytes |
| Docker build cache | 0 bytes |

The private business-storage volume is the largest data path at about 6.7 GB.
MySQL was healthy, pingable, restart count 23, and started at
2026-07-24 08:35 UTC. The production lock had no metadata file or kernel
holder. Baseline workflow run: `30081015222`, job `89442391338`.

