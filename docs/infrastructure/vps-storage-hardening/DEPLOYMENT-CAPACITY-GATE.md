# Deployment Capacity Gate

The gate runs after acquiring the production lock and before build/seed/service
changes. GitHub Actions also performs a remote pre-build gate under the same
production concurrency boundary.

Deployment is allowed only when root usage is below 85%, free space is at least
15 GiB, inode use is below 85%, and Docker and MySQL are healthy. A rejection
returns `DEPLOYMENT_BLOCKED_LOW_DISK_CAPACITY`; it does not seed, switch,
restart, or leave the lock behind.

Production deploy runs `30081434683` and `30081974638` passed the pre-build and
server-side gates. Current decision: `deployment_allowed=YES`.

