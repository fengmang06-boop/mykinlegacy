# MyKinLegacy Operations Guide

This guide is for production deployment checks on the Ubuntu server.

## Deploy

From the project directory on the server:

```bash
git pull origin main
bash deployment/deploy.sh
```

The deploy script will:

- create required Docker volumes
- initialize SSL files when needed
- build the production application image
- start MySQL and Redis
- run Prisma migrations
- run seed data when `RUN_SEED=true`
- recreate API, Worker, Web, and Nginx containers
- run the deployment health check

A deploy is considered successful only when `deployment/health-check.sh` passes.

## Check Status

Use this command when anything looks wrong:

```bash
bash deployment/status.sh
```

It prints:

- current git commit
- current branch
- last known good revision
- previous revision
- Docker Compose service status
- container health
- public HTTP and HTTPS checks
- recent API logs
- recent Web logs
- recent Worker logs
- rollback hint

## Run Health Check

Use this command for a short pass/fail verification:

```bash
bash deployment/health-check.sh
```

It checks:

- `mysql`
- `redis`
- `api`
- `web`
- `worker`
- `nginx`
- `public_http`
- `public_https`

If any item fails, run:

```bash
bash deployment/status.sh
```

## How To Read Failures

Use the failed service name to decide where to look first.

`mysql` failed:

- MySQL container is not healthy.
- Check `deployment/.env.production` database values.
- Check MySQL logs in `deployment/status.sh`.

`redis` failed:

- Redis container is not healthy.
- Check Redis container status.

`api` failed:

- API container is not responding on `/health`.
- Read the API log section in `deployment/status.sh`.
- Common causes are failed Node startup, missing environment variables, or database connection errors.

`web` failed:

- Web container is not responding on port `3000`.
- Read the Web log section in `deployment/status.sh`.

`worker` failed:

- Worker container is not running.
- Read the Worker log section in `deployment/status.sh`.

`nginx` failed:

- Nginx cannot reach its internal `/health` route.
- Check whether API and Web are healthy first.

`public_http` failed:

- The server is not reachable over public HTTP.
- Check firewall, Docker ports, and Nginx.

`public_https` failed:

- HTTPS is not reachable.
- If using self-signed TLS during bootstrap, the health check uses `curl -k`.
- Check SSL initialization and Nginx logs.

## Rollback

Use rollback only when the current deployment is broken and the previous revision was healthy.

```bash
bash deployment/rollback.sh
```

The rollback script will:

- read `deployment/.previous_revision`
- check out that git revision
- rebuild the application image when the rollback target supports production Docker builds
- recreate API, Worker, Web, and Nginx
- run the health check
- record the rollback revision as current if health passes

To rollback to a specific commit:

```bash
ROLLBACK_REVISION=<commit_hash> bash deployment/rollback.sh
```

Rollback does not downgrade database schema. If a failed deployment included irreversible database changes, stop and inspect the database before rolling back application code.

## Useful Commands

Show service status:

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml ps
```

Follow API logs:

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f api
```

Follow Web logs:

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f web
```

Follow Worker logs:

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f worker
```

Restart the current stack without pulling code:

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml up -d --no-build --force-recreate api worker web nginx
```
