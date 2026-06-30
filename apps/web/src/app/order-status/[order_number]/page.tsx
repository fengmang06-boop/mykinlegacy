import type { Metadata } from "next";

import { OrderStatusView } from "../../../components/order-status";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function OrderStatusPage({ params }: { params: Promise<{ order_number: string }> }) {
  const { order_number: orderNumber } = await params;
  return (
    <main>
      <OrderStatusView orderNumber={orderNumber} />
    </main>
  );
}
