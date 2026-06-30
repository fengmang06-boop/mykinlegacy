export type AdminRole = "super_admin" | "admin" | "support" | "finance" | "viewer";

const RANK: Record<AdminRole, number> = {
  viewer: 1,
  finance: 2,
  support: 3,
  admin: 4,
  super_admin: 5
};

export function canMutate(role: AdminRole, minimum: AdminRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export function maskStorageKey(value: string): string {
  const parts = value.split("/");
  return parts.length > 1 ? `${parts[0]}/***/${parts.at(-1)}` : "***";
}

export function assertNoUnsafeAdminText(value: string): boolean {
  return !/(raw_token|public_url|storage_key\s*:|sk_live|whsec_)/i.test(value);
}
