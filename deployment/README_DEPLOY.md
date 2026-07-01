# MyKinLegacy Deployment Sprint 001

## 1. SSH

```bash
ssh root@216.128.154.152
```

## 2. Enter Project Folder

Upload or clone the project folder to the server, then run:

```bash
cd ~/mykinlegacy
```

## 3. Install

```bash
bash deployment/install.sh
```

## 4. Deploy

```bash
bash deployment/deploy.sh
```

## 5. Open

```text
https://216.128.154.152
```

## 6. Health Check

```bash
bash deployment/health-check.sh
```

Expected result:

```text
PASS mysql
PASS redis
PASS api
PASS web
PASS worker
PASS nginx
PASS public_http
PASS public_https
PASS deployment health check
```

## 7. Enable Let's Encrypt

```bash
nano deployment/.env.production
```

Set:

```text
DOMAIN=mykinlegacy.com
TLS_MODE=letsencrypt
APP_WEB_URL=https://mykinlegacy.com
API_PUBLIC_URL=https://mykinlegacy.com
NEXT_PUBLIC_SITE_URL=https://mykinlegacy.com
APP_BASE_URL=https://mykinlegacy.com
API_BASE_URL=https://mykinlegacy.com
NEXT_PUBLIC_API_BASE_URL=/api/v1
```

Then run:

```bash
bash deployment/deploy.sh
```

## 8. Restart

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml restart
```

## 9. Update

If using Git:

```bash
git pull
bash deployment/deploy.sh
```

If uploading files manually, replace the project files and run:

```bash
bash deployment/deploy.sh
```

## 10. Rollback

If the project is a Git checkout and a previous revision was recorded:

```bash
bash deployment/rollback.sh
```

If no previous Git revision exists, rollback restarts the current stack and runs health checks.

## 11. Logs

```bash
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f web
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f api
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f worker
docker compose -p mykinlegacy --env-file deployment/.env.production -f deployment/docker-compose.yml logs -f nginx
```

## 12. Important Production Notes

- Do not commit `deployment/.env.production`.
- Default AI and email providers are mock mode.
- MySQL and Redis are private Docker services and are not exposed publicly.
