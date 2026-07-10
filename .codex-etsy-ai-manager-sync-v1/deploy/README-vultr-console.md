# MENSSKULL Etsy AI Manager Vultr Console Deploy

## What This Script Does

`deploy-vultr-console.sh` deploys the MENSSKULL Etsy AI Manager on an Ubuntu 24.04 Vultr VPS without SSH.

You run it directly inside the Vultr Console web terminal.

## Server Target

Domain:

```text
tools.mensskull.com
```

Project path:

```text
/root/mykinlegacy/mensskull-etsy-ai-manager
```

Nginx config:

```text
/etc/nginx/sites-available/tools.mensskull.com
```

PM2 process name:

```text
mensskull-etsy-ai-manager
```

## Steps Performed

1. Checks and installs required software:

```text
node
npm
git
pm2
nginx
```

2. Creates the fixed deployment directory:

```text
/root/mykinlegacy/mensskull-etsy-ai-manager
```

3. Clones or updates the GitHub repository:

```text
https://github.com/fengmang06-boop/mensskull-etsy-ai-manager.git
```

If the project already exists, the script runs:

```bash
git pull --ff-only
```

4. Installs dependencies:

```bash
npm install
```

5. Builds the app:

```bash
npm run build
```

6. Creates `.env.local` with read-only Etsy mode:

```env
DATABASE_URL="file:./dev.db"
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback
ETSY_READ_ONLY_MODE=true
ETSY_WRITE_APPROVED=false
```

7. Starts the app with PM2:

```bash
pm2 start npm --name mensskull-etsy-ai-manager -- start
pm2 save
pm2 startup
```

8. Creates an Nginx reverse proxy:

```text
tools.mensskull.com -> http://127.0.0.1:3000
```

9. Runs final checks:

```bash
pm2 status
systemctl status nginx
curl http://127.0.0.1:3000
```

## Manual Values To Fill Later

After deployment, edit:

```bash
nano /root/mykinlegacy/mensskull-etsy-ai-manager/.env.local
```

Fill these values:

```env
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
```

Keep this value unchanged:

```env
ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback
```

Keep read-only mode enabled:

```env
ETSY_READ_ONLY_MODE=true
ETSY_WRITE_APPROVED=false
```

Do not enable Etsy write mode.

## GitHub Private Repository Access

The repository is private.

When `git clone` asks for credentials:

```text
Username: your GitHub username
Password: your GitHub Personal Access Token
```

Use a token that has access to the private repository.

## SSL

This script does not configure SSL.

It does not install Certbot.

It does not request a certificate.

SSL will be configured later.

## Run Command In Vultr Console

Upload or paste the script into the server, then run:

```bash
sudo bash deploy-vultr-console.sh
```
