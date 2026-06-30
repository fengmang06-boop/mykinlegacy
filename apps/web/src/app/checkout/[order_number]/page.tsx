import type { Metadata } from "next";

import { CheckoutFlow } from "../../../components/checkout-flow";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function CheckoutPage({ params }: { params: Promise<{ order_number: string }> }) {
  const { order_number: orderNumber } = await params;
  return (
    <main>
      <CheckoutFlow orderNumber={orderNumber} />
    </main>
  );
}
