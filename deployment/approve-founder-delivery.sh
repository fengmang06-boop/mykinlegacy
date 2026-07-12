#!/usr/bin/env bash
set -euo pipefail

ORDER_NUMBER="${1:-}"
if [[ ! "$ORDER_NUMBER" =~ ^[A-Z0-9-]{8,64}$ ]]; then
  echo "Usage: bash deployment/approve-founder-delivery.sh <ORDER_NUMBER>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

cd "$SCRIPT_DIR/.."
echo "Founder delivery approval"
echo "Order: $ORDER_NUMBER"
echo "No raw email, vault token, storage key, or secret is printed."

bash "$SCRIPT_DIR/verify-download-binaries.sh" "$ORDER_NUMBER"

docker compose -p mykinlegacy --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();
const orderNumber = process.argv[2];

(async () => {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) throw new Error("order_not_found");
  if (order.paymentStatus !== "paid") throw new Error("order_not_paid");
  const metadata = order.metadataJson && typeof order.metadataJson === "object" && !Array.isArray(order.metadataJson)
    ? order.metadataJson
    : {};
  if (metadata.founder_edition !== true) throw new Error("not_founder_edition_order");
  await prisma.order.update({
    where: { id: order.id },
    data: {
      metadataJson: {
        ...metadata,
        founder_review_status: "approved",
        founder_reviewed_at: new Date().toISOString()
      },
      updatedAt: new Date()
    }
  });
  console.log(JSON.stringify({ order_number: orderNumber, founder_review_status: "approved" }));
})().finally(() => prisma.$disconnect());
NODE

docker compose -p mykinlegacy --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T worker node - "$ORDER_NUMBER" <<'NODE'
const { PrismaClient } = require("./packages/database/generated/client");
const prisma = new PrismaClient();
const orderNumber = process.argv[2];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

(async () => {
  let order = null;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        emailLogs: {
          where: { provider: "resend", status: "sent", providerMessageId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    if (order?.emailLogs[0]?.providerMessageId) break;
    await sleep(2000);
  }
  if (!order) throw new Error("order_not_found");
  const latestEmail = order.emailLogs[0];
  if (!latestEmail?.providerMessageId) throw new Error("delivery_email_provider_acceptance_not_confirmed");
  await prisma.order.update({
    where: { id: order.id },
    data: {
      orderStatus: "completed",
      fulfillmentStatus: "completed",
      completedAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log(JSON.stringify({
    order_number: orderNumber,
    founder_delivery: "released",
    email_provider: latestEmail.provider,
    email_status: latestEmail.status,
    provider_message_id: latestEmail.providerMessageId
  }));
})().finally(() => prisma.$disconnect());
NODE

bash "$SCRIPT_DIR/inspect-resend-message.sh" "$ORDER_NUMBER"

echo "FOUNDER_DELIVERY_APPROVAL_COMPLETE order=$ORDER_NUMBER"
