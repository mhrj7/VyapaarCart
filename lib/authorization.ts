export const marketplaceRoles = ["buyer", "seller", "seller_staff", "admin"] as const;
export type MarketplaceRole = (typeof marketplaceRoles)[number];

export type Actor = {
  id: number;
  clerkId: string;
  role: MarketplaceRole;
  staffForSellerId: number | null;
};

export function isMarketplaceRole(value: string): value is MarketplaceRole {
  return marketplaceRoles.includes(value as MarketplaceRole);
}

export function sellerAccountId(actor: Actor) {
  return actor.role === "seller_staff" ? actor.staffForSellerId : actor.id;
}

export function canManageSeller(actor: Actor, sellerId: number) {
  return actor.role === "admin" ||
    ((actor.role === "seller" || actor.role === "seller_staff") && sellerAccountId(actor) === sellerId);
}

export function canBuy(actor: Actor) {
  return actor.role === "buyer" || actor.role === "seller";
}

export function canManageOwnRecord(actor: Actor, ownerId: number) {
  return actor.role === "admin" || actor.id === ownerId;
}
