import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentSuccess } from "../../../components/payment-success";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default function PaymentSuccessPage() {
  return (
    <main>
      <Suspense fallback={<div className="section">Payment received, verifying your order.</div>}>
        <PaymentSuccess />
      </Suspense>
    </main>
  );
}
