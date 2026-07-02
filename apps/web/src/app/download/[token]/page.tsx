import type { Metadata } from "next";

import { DownloadVault } from "../../../components/download-vault";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  openGraph: null
};

export default async function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="premium-page vault-page">
      <DownloadVault token={token} />
    </main>
  );
}
