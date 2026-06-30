# MyKinLegacy Vultr Production Bootstrap

This folder deploys the current MyKinLegacy monorepo to a fresh Vultr Ubuntu 24.04 server with Docker Compose.

## Services

- `web`: customer Next.js app
- `api`: NestJS API
- `worker`: background worker
- `mysql`: MySQL 8
- `redis`: Redis 7
- `nginx`: HTTPS reverse proxy

## 1. Server Prerequisites

Create a Vultr Ubuntu 24.04 server and point DNS records to the server IP:

- `A mykinlegacy.com -> server_ip`
- `A www.mykinlegacy.com -> server_ip`

Open firewall ports:

- `22` SSH
- `80` HTTP for Let's Encrypt
- `443` HTTPS

## 2. Copy Project To Server

Place the full repository on the server, then enter:

```bash
cd /path/to/mykinlegacy/production-bootstrap
```

The compose file mounts the parent repository directory into the app containers.

## 3. Environment

The first deploy creates `.env.production` automatically from `.env.production.example` and generates database/session secrets when `openssl` is available.

Before real customer traffic, review:

```bash
nano .env.production
```

Keep these as placeholders until the relevant provider is live:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY` or other email provider key

The bootstrap uses mock AI/email values by default so the server can start before provider go-live.

## 4. Deploy

Run:

```bash
bash deploy.sh
```

The script will:

1. Install Docker and Docker Compose plugin if missing.
2. Create `.env.production` if missing.
3. Request a Let's Encrypt certificate for `mykinlegacy.com` and `www.mykinlegacy.com`.
4. Start MySQL and Redis.
5. Run Prisma generate, migrations, and seed data.
6. Build and start API, Worker, Web, and Nginx.
7. Run the health check.

## 5. Health Check

Run anytime:

```bash
bash deploy-health-check.sh
```

Expected output ends with:

```text
PASS production bootstrap health check
```

## 6. Restart

```bash
docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml restart
```

## 7. Update

After pulling or copying new code:

```bash
cd production-bootstrap
docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml pull
bash deploy.sh
```

For source-only updates, `bash deploy.sh` is enough because app containers rebuild from the mounted repository.

## 8. Logs

```bash
docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml logs -f web
docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml logs -f api
docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml logs -f worker
docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml logs -f nginx
```

## 9. SSL Renewal

Manual renewal:

```bash
docker run --rm \
  -v mykinlegacy_letsencrypt:/etc/letsencrypt \
  certbot/certbot renew

docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml restart nginx
```

Recommended cron:

```bash
0 3 * * 0 cd /path/to/mykinlegacy/production-bootstrap && docker run --rm -v mykinlegacy_letsencrypt:/etc/letsencrypt certbot/certbot renew && docker compose -p mykinlegacy --env-file .env.production -f docker-compose.yml restart nginx
```

## 10. Production Notes

- Do not enable admin bootstrap for public production.
- Do not commit `.env.production`.
- Keep MySQL and Redis private inside Docker; they are not exposed to the public internet.
- Stripe live keys, real AI provider keys, and real email provider keys should only be added after the Founder has verified the mock production deployment.
- This bootstrap is intentionally simple. A later hardening pass should add image-based builds, external object storage, automated backups, monitoring, and zero-downtime deploys.
