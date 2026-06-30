# MyKinLegacy Operations Guide

This guide is for production deployment, status checks, failure reporting, and rollback.

## How To Deploy

Production deploy is normally automatic after a commit is pushed to `main`.

Manual server deploy is still available. Run these commands on the production server from the project root:

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

## Automatic GitHub Actions Deploy

The workflow file is:

```text
.github/workflows/deploy-production.yml
```

It runs on:

- every push to `main`
- manual `workflow_dispatch`

The workflow connects to the VPS over SSH, enters `PROD_PROJECT_DIR`, pulls `main`, runs deployment, and prints production status:

```bash
git fetch origin main
git checkout main
git pull --ff-only origin main
bash deployment/deploy.sh
bash deployment/status.sh
```

If `deployment/deploy.sh` fails, the GitHub Actions run fails. If `deployment/health-check.sh` fails inside deploy, the GitHub Actions run fails.

## GitHub Secrets Required

Add these repository secrets in GitHub:

```text
PROD_SSH_HOST
PROD_SSH_USER
PROD_SSH_PORT
PROD_SSH_PRIVATE_KEY
PROD_PROJECT_DIR
```

Recommended values:

```text
PROD_SSH_HOST=216.128.154.152
PROD_SSH_USER=root
PROD_SSH_PORT=22
PROD_PROJECT_DIR=/root/mykinlegacy
```

Use the real production project folder for `PROD_PROJECT_DIR`.

## One-Time SSH Key Setup For GitHub Actions

Create a deployment key on your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-mykinlegacy" -f mykinlegacy_github_actions -N ""
```

Add the public key to the VPS:

```bash
cat mykinlegacy_github_actions.pub | ssh root@216.128.154.152 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Open the private key:

```bash
cat mykinlegacy_github_actions
```

Copy the full private key, including:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Add it to GitHub:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Use:

```text
Name: PROD_SSH_PRIVATE_KEY
Value: full private key content
```

Then add:

```text
PROD_SSH_HOST=216.128.154.152
PROD_SSH_USER=root
PROD_SSH_PORT=22
PROD_PROJECT_DIR=/root/mykinlegacy
```

After the secret is saved, delete the private key from your local machine if you do not need it:

```bash
rm mykinlegacy_github_actions
```

Keep the `.pub` file only if you want a local record of which public key was installed.

## Manual GitHub Actions Deploy

To run production deployment manually:

```text
GitHub repo -> Actions -> Deploy Production -> Run workflow -> main -> Run workflow
```

The run log should include:

```text
DEPLOYMENT_SUCCESS <commit_hash>
```

It should also print the output of:

```bash
bash deployment/status.sh
```

## Automatic Deploy Verification

After a GitHub Actions deploy finishes:

1. Open the Actions run.
2. Confirm the deploy step passed.
3. Confirm the log includes `DEPLOYMENT_SUCCESS`.
4. Confirm `public_http`, `public_https`, `api`, `web`, `worker`, `mysql`, `redis`, and `nginx` are healthy in the status output.

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

## Manual GitHub Actions Rollback

The workflow file is:

```text
.github/workflows/rollback-production.yml
```

To run rollback from GitHub:

```text
GitHub repo -> Actions -> Rollback Production -> Run workflow -> commit_hash -> Run workflow
```

The rollback workflow runs:

```bash
bash deployment/rollback.sh <commit_hash>
bash deployment/status.sh
```

Use rollback only for a known healthy commit. Rollback does not automatically reverse database migrations.

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
