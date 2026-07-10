#!/usr/bin/env bash
set -euo pipefail

APP_NAME="mensskull-etsy-ai-manager"
DOMAIN="tools.mensskull.com"
APP_DIR="/root/mykinlegacy/mensskull-etsy-ai-manager"
PORT="3000"
NGINX_CONF="/etc/nginx/conf.d/${DOMAIN}.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root or with sudo."
  exit 1
fi

install_package() {
  local package_name="$1"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y "$package_name"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "$package_name"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y "$package_name"
  else
    echo "No supported package manager found. Install $package_name manually."
    exit 1
  fi
}

install_node_lts() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo "Node found: $(node -v)"
    echo "npm found: $(npm -v)"
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
  else
    install_package nodejs
    install_package npm
  fi
}

install_node_lts

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if ! command -v nginx >/dev/null 2>&1; then
  install_package nginx
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"
APP_REAL="$(realpath "$APP_DIR")"
EXPECTED_REAL="$(realpath /root/mykinlegacy/mensskull-etsy-ai-manager)"
if [[ "$APP_REAL" != "$EXPECTED_REAL" ]]; then
  echo "Refusing deploy outside fixed Etsy app dir: $APP_REAL"
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "package.json not found in $APP_DIR."
  echo "Sync the project files into $APP_DIR first, then rerun this script."
  exit 1
fi

cat > "$APP_DIR/.env.local" <<'ENVEOF'
DATABASE_URL="file:./dev.db"
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback
ETSY_USER_ID=
ETSY_SHOP_ID=
ETSY_ACCESS_TOKEN=
ETSY_REFRESH_TOKEN=
ETSY_READ_ONLY_MODE=true
ETSY_WRITE_APPROVED=false
ENVEOF
chmod 600 "$APP_DIR/.env.local"
if ! grep -q '^DATABASE_URL="*file:' "$APP_DIR/.env.local"; then
  echo "Refusing deploy: Etsy DATABASE_URL must be local SQLite."
  exit 1
fi

npm install
npm run build

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" -- start
fi
pm2 save

if command -v systemctl >/dev/null 2>&1; then
  pm2 startup systemd -u root --hp /root >/dev/null || true
fi

mkdir -p /etc/nginx/conf.d
if [[ -f "$NGINX_CONF" ]]; then
  cp -a "$NGINX_CONF" "${NGINX_CONF}.backup-$(date +%Y%m%d%H%M%S)"
fi
cat > "$NGINX_CONF" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF

nginx -t || {
  echo "nginx -t failed; refusing to reload nginx."
  exit 1
}
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi

if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email || true
else
  echo "certbot not found. Install certbot or configure SSL in your hosting panel, then enable HTTPS for $DOMAIN."
fi

echo "Deployment script finished."
echo "App directory: $APP_DIR"
echo "PM2 app: $APP_NAME"
echo "Nginx config: $NGINX_CONF"
