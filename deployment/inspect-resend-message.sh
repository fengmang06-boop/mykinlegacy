#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [[ ! "$ORDER_NUMBER" =~ ^[A-Z0-9-]{8,64}$ ]]; then
  echo "Usage: bash deployment/inspect-resend-message.sh <ORDER_NUMBER>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

cd "$SCRIPT_DIR/.."
echo "Resend delivery status inspection"
echo "Order: $ORDER_NUMBER"
echo "No recipient address, message content, vault token, or secret is printed."

docker compose -p mykinlegacy --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();
const orderNumber = process.argv[2];

(async () => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      emailLogs: {
        where: { provider: "resend" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
  if (!order) throw new Error("order_not_found");
  const emailLog = order.emailLogs[0] ?? null;
  const messageId = emailLog?.providerMessageId ?? null;
  if (!messageId) {
    console.log(JSON.stringify({
      order_number: orderNumber,
      provider: "resend",
      provider_message_id: null,
      provider_status: "not_found"
    }));
    return;
  }
  if (!process.env.RESEND_API_KEY) throw new Error("resend_api_key_missing");
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(messageId)}`, {
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` }
  });
  const payload = await response.json().catch(() => ({}));
  console.log(JSON.stringify({
    order_number: orderNumber,
    provider: "resend",
    provider_message_id: messageId,
    local_status: emailLog.status,
    provider_http_status: response.status,
    provider_status: response.ok ? payload.last_event ?? "accepted" : "not_found"
  }));
  if (!response.ok) process.exitCode = 2;
})().finally(() => prisma.$disconnect());
NODE
