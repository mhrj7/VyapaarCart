import { and, eq } from "drizzle-orm";
import type { getDb } from "../db";
import { listings, users } from "../db/schema";

type Db = ReturnType<typeof getDb>;

export async function ensureUser(db: Db, clerkId: string) {
  await db.insert(users).values({ clerkId }).onConflictDoNothing();
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) throw new Error("Could not create marketplace profile.");
  return user;
}

export function imageUrl(imageKey: string | null) {
  if (!imageKey) return null;
  return isListingImageUrl(imageKey)
    ? imageKey
    : `/api/images?key=${encodeURIComponent(imageKey)}`;
}

export function isListingImageUrl(value: string, clerkId?: string) {
  try {
    const url = new URL(value);
    const validHost = url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
    const validPath = url.pathname.startsWith(`/listings/${clerkId ? `${clerkId}/` : ""}`);
    return validHost && validPath;
  } catch {
    return false;
  }
}

export function serializeListing(row: typeof listings.$inferSelect, sellerName = "VyapaarCart seller") {
  return { ...row, sellerName, imageUrl: imageUrl(row.imageKey) };
}

export async function requireListingOwner(db: Db, listingId: string, clerkId: string) {
  const [row] = await db
    .select({ listing: listings, user: users })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(and(eq(listings.id, listingId), eq(users.clerkId, clerkId)))
    .limit(1);
  return row?.listing ?? null;
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return Response.json({ error: "Marketplace storage is being prepared. Please try again shortly." }, { status: 503 });
  }
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
