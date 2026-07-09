export const etsyScopes = [
  "shops_r",
  "listings_r",
  "listings_w",
  "transactions_r",
  "cart_r",
  "profile_r"
] as const;

export type EtsyScope = (typeof etsyScopes)[number];
