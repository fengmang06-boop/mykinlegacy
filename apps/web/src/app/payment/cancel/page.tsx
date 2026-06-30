import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default async function PaymentCancelPage({
  searchParams
}: {
  searchParams: Promise<{ order_number?: string }>;
}) {
  const { order_number: orderNumber } = await searchParams;
  return (
    <main>
      <section className="journey-shell">
        <div className="section">
          <div className="journey-card">
            <p className="eyebrow">Payment cancelled</p>
            <h1>Payment was cancelled.</h1>
            <p className="lead">
              Your order has not been paid, and vault preparation has not started.
            </p>
            <Link className="button" href={orderNumber ? `/checkout/${orderNumber}` : "/create"}>
              Return to checkout
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
