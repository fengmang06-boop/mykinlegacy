# Docker Image and Cache Retention Policy

Always retain current production, the immediately previous healthy rollback,
the most recently verified healthy image, compose/deployment base images,
database and all named business volumes, controlled database backups, and
incident evidence.

Only a dangling or unreferenced image may be proposed when it has no container
reference, no current/rollback/release/compose/deployment reference, is absent
from the protected list, has a known dependency classification, and can be
rebuilt. Build cache is eligible only after the same dependency checks.

Unknown resources are never deleted. Volume pruning and unqualified
`docker system prune -a` are forbidden. The weekly automation is dry-run only;
an actual deletion requires a reviewed candidate list and production lock.

Recommended evidence retention: 7 days deployment logs, 14 days application
error logs, 30 days compressed monitoring summaries, plus the latest complete
database backup and supported incrementals.

