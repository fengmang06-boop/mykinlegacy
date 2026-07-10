# MENSSKULL / MyKinLegacy Isolation Plan

Status: temporary hardening active; migration not executed.

## Current Temporary Boundary

- MyKinLegacy production remains under `/root/mykinlegacy` and runs through Docker Compose.
- MENSSKULL Etsy AI Manager remains at `/root/mykinlegacy/mensskull-etsy-ai-manager` for now and runs through the fixed PM2 process `mensskull-etsy-ai-manager`.
- MyKinLegacy workflows use the `mykinlegacy-production` concurrency group.
- MENSSKULL Etsy / Growth OS workflows use the `mensskull-growth-os-production` concurrency group.
- Etsy deployments must only operate on `/root/mykinlegacy/mensskull-etsy-ai-manager` and the fixed PM2 process.
- Etsy runtime requires a local SQLite `file:` database inside the app directory.

## Target Directory Layout

```text
/opt/mykinlegacy/
/opt/mensskull-growth-os/
```

## Target Runtime Boundary

- Separate Linux users:
  - `mykinlegacy`
  - `mensskull`
- Separate process managers:
  - MyKinLegacy: Docker Compose project `mykinlegacy`
  - MENSSKULL Growth OS: PM2 or systemd service `mensskull-growth-os`
- Separate environment files:
  - `/opt/mykinlegacy/deployment/.env.production`
  - `/opt/mensskull-growth-os/.env.local`
- Separate databases:
  - MyKinLegacy: Docker MySQL volume
  - MENSSKULL Growth OS: dedicated SQLite or Postgres database not reused by MyKinLegacy
- Separate logs:
  - MyKinLegacy Docker logs
  - MENSSKULL Growth OS PM2/systemd logs
- Separate Nginx files:
  - `mykinlegacy.com.conf`
  - `tools.mensskull.com.conf`

## Migration Steps Later

1. Stop only the MENSSKULL PM2 process.
2. Copy `/root/mykinlegacy/mensskull-etsy-ai-manager` to `/opt/mensskull-growth-os`.
3. Copy `.env.local`, `prisma/dev.db`, exports, growth docs, and image queue assets.
4. Start the app from `/opt/mensskull-growth-os` with the same fixed process name or a new systemd unit.
5. Update `tools.mensskull.com` Nginx upstream only.
6. Run `nginx -t`; reload only if the test passes.
7. Verify `https://tools.mensskull.com`, Etsy status, and `https://mykinlegacy.com/health`.
8. Keep the old directory read-only until the new path is stable.

## Rollback Later

- Stop the new MENSSKULL service.
- Restore Nginx `tools.mensskull.com` upstream to the old app.
- Restart the old PM2 process from `/root/mykinlegacy/mensskull-etsy-ai-manager`.
- Do not touch MyKinLegacy Docker services unless a separate MyKinLegacy incident requires it.

## Migration Timing

Migration is recommended before the Growth OS adds more write-capable workflows or more channel integrations. It is not required immediately while the temporary hardening remains active.
