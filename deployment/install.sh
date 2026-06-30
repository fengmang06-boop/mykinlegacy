#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

echo "Installing MyKinLegacy server prerequisites for Ubuntu 24.04..."

$SUDO apt-get update
$SUDO apt-get install -y \
  ca-certificates \
  curl \
  fail2ban \
  git \
  gnupg \
  lsb-release \
  openssl \
  ufw

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Installing Docker and Docker Compose..."
  $SUDO install -m 0755 -d /etc/apt/keyrings
  $SUDO rm -f /etc/apt/keyrings/docker.gpg
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

$SUDO systemctl enable --now docker
$SUDO systemctl enable --now fail2ban

$SUDO tee /etc/fail2ban/jail.d/mykinlegacy-sshd.conf >/dev/null <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF

$SUDO systemctl restart fail2ban

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not available after installation."
  exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  $SUDO ufw allow OpenSSH >/dev/null || true
  $SUDO ufw allow 22/tcp >/dev/null || true
  $SUDO ufw allow 80/tcp >/dev/null || true
  $SUDO ufw allow 443/tcp >/dev/null || true
  $SUDO ufw --force enable >/dev/null || true
fi

echo "PASS install complete"
echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version)"
echo "fail2ban: active"
