# Docker Resource Dependency Audit

## Protected images

- `08ed1e6...` / `sha256:6bb46f...`: current production, used by three containers.
- `c71c962...` / `sha256:e5a035...`: protected rollback image, referenced by
  `mykinlegacy-rollback-image-guard`.
- `mysql`, `redis`, `nginx`, `caddy`, `wg-easy`, and `alpine:3.20`: compose,
  deployment-base, database, or unknown external dependencies; protected.

## Protected volumes

- `mykinlegacy_mysql_data`: database.
- `mykinlegacy_private_storage`: customer/business assets.
- Redis, certbot webroot, nginx certificates, and node-store named volumes.
- `wg-easy` volume: unrelated/unknown dependency, therefore protected.

## Removable resources

- Dangling images: 0.
- Unreferenced verified-old release images: 0.
- Build cache eligible for removal: 0 bytes.
- Anonymous or named volumes eligible for removal: 0.

No object with an unknown dependency is removable. Current and rollback image
IDs are explicit protected inputs to the cleanup script.

