# VPS Capacity Monitor Deployment

GitHub Actions `MyKinLegacy VPS Capacity Monitor` runs at minute 7 every hour,
is read-only, non-concurrent, has a ten-minute timeout, and retains sanitized
artifacts for 30 days. First manual run `30081770297` succeeded in 24 seconds
and produced artifact `vps-capacity-status-30081770297`.

Windows tasks installed:

- `MyKinLegacy VPS Capacity Monitor`: hourly S4U read-only SSH sync, IgnoreNew,
  ten-minute execution limit. Manual validation returned task result 0.
- `MyKinLegacy VPS Capacity Notification`: hourly interactive alert; INFO is
  silent, WARNING/HIGH/CRITICAL produces a toast. A safe INFO force-test
  produced a receipt with no credentials or customer PII.

The daily 09:00 report reads the latest sanitized capacity JSON and includes
disk, inode, Docker, MySQL, lock, largest path, alert level, and deployment
decision. The local sync uses the existing protected operations SSH key and
does not store a GitHub token.

