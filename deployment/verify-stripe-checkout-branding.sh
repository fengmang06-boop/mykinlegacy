#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

cd "$SCRIPT_DIR/.."

echo "Stripe Checkout branding verification"
echo "Checkout remains paused for public order creation."
echo "This creates one unpaid verification Session through the deployed StripeAdapter."

docker compose -p mykinlegacy --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T api node - <<'NODE'
const { StripeAdapter, STRIPE_CHECKOUT_API_VERSION } = require("./apps/api/dist/payments/stripe.adapter.js");

(async () => {
  const verificationId = `BRAND-${Date.now()}`;
  const adapter = new StripeAdapter();
  const result = await adapter.createCheckoutSession({
    orderNumber: verificationId,
    amountCents: 4900,
    currency: "USD",
    productName: "MyKinLegacy Family Legacy Collection",
    successUrl: "https://mykinlegacy.com/payment/success?branding_verification=1",
    cancelUrl: "https://mykinlegacy.com/payment/cancel?branding_verification=1",
    metadata: {
      verification_mode: "unpaid_checkout_branding",
      order_number: verificationId,
      product_code: "family_legacy_collection"
    }
  });
  console.log(`stripe_api_version=${STRIPE_CHECKOUT_API_VERSION}`);
  console.log("checkout_public_order_path_enabled=false");
  console.log("checkout_verification_paid=false");
  console.log(`checkout_session_id=${result.id}`);
  console.log(`checkout_url=${result.url}`);
})().catch((error) => {
  console.error(`STRIPE_BRANDING_VERIFICATION_FAILED ${error.message}`);
  process.exit(1);
});
NODE
