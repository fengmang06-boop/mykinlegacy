export function formatMoneyFromCents(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(priceCents / 100);
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) {
    return email;
  }
  return `${name.slice(0, 2)}***@${domain}`;
}
