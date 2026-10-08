import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { favourites, listings, users } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { actorFor, ensureUser, routeError, serializeListing } from "../../../lib/marketplace";
import { canBuy } from "../../../lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to see saved listings." }, { status: 401 });
    const db = getDb();
    if (!canBuy(await actorFor(db, identity.clerkId))) return Response.json({ error: "This account cannot save buyer favourites." }, { status: 403 });
    const user = await ensureUser(db, identity.clerkId);
    const rows = await db.select({ listing: listings, sellerName: users.displayName }).from(favourites).innerJoin(listings, eq(favourites.listingId, listings.id)).innerJoin(users, eq(listings.sellerId, users.id)).where(eq(favourites.userId, user.id)).orderBy(desc(favourites.createdAt));
    return Response.json({ listings: rows.map((row) => serializeListing(row.listing, row.sellerName)) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to save listings." }, { status: 401 });
    const { listingId } = await request.json() as { listingId?: string };
    if (!listingId) return Response.json({ error: "Listing is required." }, { status: 400 });
    const db = getDb();
    if (!canBuy(await actorFor(db, identity.clerkId))) return Response.json({ error: "This account cannot save buyer favourites." }, { status: 403 });
    const user = await ensureUser(db, identity.clerkId);
    const [listing] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) return Response.json({ error: "Listing not found." }, { status: 404 });
    await db.insert(favourites).values({ userId: user.id, listingId }).onConflictDoNothing();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to manage saved listings." }, { status: 401 });
    const { listingId } = await request.json() as { listingId?: string };
    if (!listingId) return Response.json({ error: "Listing is required." }, { status: 400 });
    const db = getDb();
    if (!canBuy(await actorFor(db, identity.clerkId))) return Response.json({ error: "This account cannot manage buyer favourites." }, { status: 403 });
    const user = await ensureUser(db, identity.clerkId);
    await db.delete(favourites).where(and(eq(favourites.userId, user.id), eq(favourites.listingId, listingId)));
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
