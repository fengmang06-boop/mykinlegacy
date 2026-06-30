# MyKinLegacy Operations Guide

This guide is for production deployment, status checks, failure reporting, and rollback.

## How To Deploy

Run these commands on the production server from the project root:

```bash
git checkout main
git pull origin main
bash deployment/deploy.sh
```

The deploy script will:

- print the current commit before deploy
- pull the latest code when it is on a normal Git branch
- create required Docker volumes
- initialize SSL files when needed
- build the production application image
- start MySQL and Redis
- run Prisma migrations
- run seed data when `RUN_SEED=true`
- recreate API, Worker, Web, and Nginx containers
- run `deployment/health-check.sh`
- save `deployment/.last-successful-commit` only after health checks pass

Success prints:

```text
DEPLOYMENT_SUCCESS <commit_hash>
```

Failure prints:

```text
DEPLOYMENT_FAILED <commit_hash>
```

## How To Check Status

Use this command whenever deployment looks unclear:

```bash
bash deployment/status.sh
```

It prints:

- current Git branch
- current Git commit
- latest local commit message
- last successful deployment commit
- Docker Compose service status
- container health status
- public HTTP check
- public HTTPS check
- API `/health` result
- disk usage
- memory usage
- last 80 API log lines
- last 80 Web log lines
- last 80 Worker log lines
- rollback hint

## Short Health Check

Use this command for a compact pass/fail check:

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

## How To Read Health Check Failures

`mysql` failed:

- Database container is unhealthy.
- Check `deployment/.env.production`.
- Send MySQL health output and API logs to ChatGPT.

`redis` failed:

- Redis container is unhealthy.
- Check container status in `deployment/status.sh`.

`api` failed:

- API is not answering `/health`.
- Send API logs, current commit, and container health to ChatGPT.

`web` failed:

- Next.js app is not answering on port `3000`.
- Send Web logs and build output to ChatGPT.

`worker` failed:

- Worker container is not running or unhealthy.
- Send Worker logs to ChatGPT.

`nginx` failed:

- Public routing may be broken.
- Check whether API and Web are healthy first.

`public_http` failed:

- Public HTTP cannot reach `/health`.
- Check firewall, Docker ports, and Nginx.

`public_https` failed:

- HTTPS cannot reach `/health`.
- Check SSL mode, certificate initialization, and Nginx logs.

## What Logs To Send To ChatGPT

Run:

```bash
bash deployment/status.sh
```

Send the full output, especially:

- Git section
- Docker compose service status
- Container health status
- Public URL checks
- API `/health` result
- Recent API logs
- Recent Web logs
- Recent Worker logs
- Disk and memory usage

Avoid sending real secrets from `deployment/.env.production`.

## How To Roll Back

Rollback requires a specific commit hash:

```bash
bash deployment/rollback.sh <commit_hash>
```

Example:

```bash
bash deployment/rollback.sh 3254f28
```

The rollback script will:

- confirm before doing anything destructive
- check out the target commit
- run `deployment/deploy.sh`
- run `deployment/health-check.sh`
- print recent API/Web/Worker logs if rollback fails
- record the rollback target as last successful only if health checks pass

Rollback does not automatically roll back database migrations. If a failed deploy included database changes, stop and inspect before rolling back application code.

## Production Safety Rules

- Do not edit production files manually inside containers.
- Do not commit `deployment/.env.production`.
- Do not paste production secrets into ChatGPT.
- Do not run rollback without a known target commit.
- Do not deploy from an uncommitted working tree.
- Do not change Stripe live settings during deployment debugging.
- Do not run database-destructive commands without a separate backup.
- Always run `bash deployment/status.sh` after a failed deploy.
- Treat `DEPLOYMENT_SUCCESS` as the only deploy success signal.
- Treat `DEPLOYMENT_FAILED` as a stop-and-diagnose signal.
