#!/usr/bin/env bash
set -euo pipefail

APP_NAME="mensskull-etsy-ai-manager"
DOMAIN="tools.mensskull.com"
APP_DIR="/root/mykinlegacy/mensskull-etsy-ai-manager"
REPO_URL="https://github.com/fengmang06-boop/mensskull-etsy-ai-manager.git"
PORT="3000"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script as root in the Vultr Console:"
  echo "sudo bash deploy-vultr-console.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Updating package index"
apt-get update -y

install_if_missing() {
  local command_name="$1"
  local package_name="$2"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "==> Installing ${package_name}"
    apt-get install -y "$package_name"
  else
    echo "==> ${command_name} already installed: $($command_name --version 2>/dev/null | head -n 1 || true)"
  fi
}

install_node_if_missing() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo "==> node already installed: $(node -v)"
    echo "==> npm already installed: $(npm -v)"
    return
  fi

  echo "==> Installing Node.js 22 LTS and npm"
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
}

install_node_if_missing
install_if_missing git git
install_if_missing nginx nginx

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing pm2"
  npm install -g pm2
else
  echo "==> pm2 already installed: $(pm2 -v)"
fi

echo "==> Creating fixed Etsy app directory"
mkdir -p "$APP_DIR"

clone_or_pull_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    echo "==> Project exists. Pulling latest code"
    cd "$APP_DIR"
    git pull --ff-only
    return
  fi

  if [[ -d "$APP_DIR" && -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]]; then
    echo "ERROR: $APP_DIR exists but is not a git repository."
    echo "Move it away or delete it, then rerun this script."
    exit 1
  fi

  echo "==> Cloning private GitHub repository"
  echo "If GitHub asks for credentials, use your GitHub username and a Personal Access Token."
  git clone "$REPO_URL" "$APP_DIR"
}

clone_or_pull_repo

cd "$APP_DIR"
APP_REAL="$(realpath "$APP_DIR")"
EXPECTED_REAL="$(realpath /root/mykinlegacy/mensskull-etsy-ai-manager)"
if [[ "$APP_REAL" != "$EXPECTED_REAL" ]]; then
  echo "Refusing deploy outside fixed Etsy app dir: $APP_REAL"
  exit 1
fi

if [[ ! -f "${APP_DIR}/.env.local" ]]; then
  echo "==> Creating .env.local"
  cat > "${APP_DIR}/.env.local" <<'ENVEOF'
DATABASE_URL="file:./dev.db"
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback
ETSY_READ_ONLY_MODE=true
ETSY_WRITE_APPROVED=false
ENVEOF
else
  echo "==> .env.local already exists. Keeping existing values."
fi

if grep -q '^ETSY_READ_ONLY_MODE=' "${APP_DIR}/.env.local"; then
  sed -i 's/^ETSY_READ_ONLY_MODE=.*/ETSY_READ_ONLY_MODE=true/' "${APP_DIR}/.env.local"
else
  echo 'ETSY_READ_ONLY_MODE=true' >> "${APP_DIR}/.env.local"
fi

if grep -q '^ETSY_WRITE_APPROVED=' "${APP_DIR}/.env.local"; then
  sed -i 's/^ETSY_WRITE_APPROVED=.*/ETSY_WRITE_APPROVED=false/' "${APP_DIR}/.env.local"
else
  echo 'ETSY_WRITE_APPROVED=false' >> "${APP_DIR}/.env.local"
fi

if grep -q '^ETSY_REDIRECT_URI=' "${APP_DIR}/.env.local"; then
  sed -i 's#^ETSY_REDIRECT_URI=.*#ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback#' "${APP_DIR}/.env.local"
else
  echo 'ETSY_REDIRECT_URI=https://tools.mensskull.com/api/etsy/callback' >> "${APP_DIR}/.env.local"
fi

chmod 600 "${APP_DIR}/.env.local"
if ! grep -q '^DATABASE_URL="*file:' "${APP_DIR}/.env.local"; then
  echo "Refusing deploy: Etsy DATABASE_URL must be local SQLite."
  exit 1
fi

echo "==> Installing project dependencies"
npm install

echo "==> Building Next.js app"
npm run build

echo "==> Starting app with PM2"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start npm --name "$APP_NAME" -- start
fi
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "==> Writing Nginx reverse proxy config"
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

ln -sfn "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"

echo "==> Testing Nginx config"
nginx -t || {
  echo "nginx -t failed; refusing to reload nginx."
  exit 1
}

echo "==> Reloading Nginx"
systemctl enable nginx
systemctl reload nginx

echo "==> Final checks"
pm2 status
systemctl status nginx --no-pager -l
curl -I "http://127.0.0.1:${PORT}" || true

echo "==> Deployment complete"
echo "App path: ${APP_DIR}"
echo "PM2 process: ${APP_NAME}"
echo "Nginx config: ${NGINX_CONF}"
echo "Domain HTTP URL: http://${DOMAIN}"
