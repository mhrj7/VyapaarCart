import { eq } from "drizzle-orm";
import type { getDb } from "../db";
import { listings, users } from "../db/schema";
import { isListingImageKey, publicImageUrl } from "./object-storage";
import { canManageSeller, type Actor, isMarketplaceRole, isSellerApprovalStatus } from "./authorization";

type Db = ReturnType<typeof getDb>;

export async function ensureUser(db: Db, clerkId: string) {
  const adminClerkIds = new Set((process.env.ADMIN_CLERK_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  await db.insert(users).values({ clerkId, role: adminClerkIds.has(clerkId) ? "admin" : "buyer" }).onConflictDoNothing();
  if (adminClerkIds.has(clerkId)) await db.update(users).set({ role: "admin", staffForSellerId: null }).where(eq(users.clerkId, clerkId));
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) throw new Error("Could not create marketplace profile.");
  return user;
}

export async function actorFor(db: Db, clerkId: string): Promise<Actor> {
  const user = await ensureUser(db, clerkId);
  if (!isMarketplaceRole(user.role)) throw new Error("User has an invalid marketplace role.");
  if (!isSellerApprovalStatus(user.sellerApprovalStatus)) throw new Error("User has an invalid seller approval status.");
  return { id: user.id, clerkId: user.clerkId, role: user.role, staffForSellerId: user.staffForSellerId, sellerApprovalStatus: user.sellerApprovalStatus };
}

export function imageUrl(imageKey: string | null) {
  if (!imageKey) return null;
  if (isListingImageKey(imageKey)) return publicImageUrl(imageKey);
  // Existing Vercel Blob URLs remain readable while listing media is migrated.
  return imageKey.startsWith("https://") ? imageKey : null;
}

export function serializeListing(row: typeof listings.$inferSelect, sellerName = "VyapaarCart seller") {
  return { ...row, sellerName, imageUrl: imageUrl(row.imageKey) };
}

export async function requireListingOwner(db: Db, listingId: string, actor: Actor) {
  const [row] = await db
    .select({ listing: listings, user: users })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(eq(listings.id, listingId))
    .limit(1);
  return row && canManageSeller(actor, row.listing.sellerId) ? row.listing : null;
}

export function routeError(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === "P0022") return Response.json({ error: "Stock cannot be lower than active checkout holds. Wait for expiry, then reload inventory." }, { status: 409 });
    current = "cause" in current ? current.cause : null;
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return Response.json({ error: "Marketplace storage is being prepared. Please try again shortly." }, { status: 503 });
  }
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
