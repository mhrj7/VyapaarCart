import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { conversations, listings } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { actorFor, ensureUser, routeError } from "../../../lib/marketplace";
import { canBuy, sellerAccountId } from "../../../lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to see messages." }, { status: 401 });
    const db = getDb();
    if (!canBuy(await actorFor(db, identity.clerkId))) return Response.json({ error: "This account cannot start buyer conversations." }, { status: 403 });
    const user = await ensureUser(db, identity.clerkId);
    const actor = await actorFor(db, identity.clerkId);
    const sellerId = sellerAccountId(actor);
    const scope = actor.role === "admin" ? undefined : or(eq(conversations.buyerId, user.id), ...(sellerId ? [eq(conversations.sellerId, sellerId)] : []));
    const base = db.select({ conversation: conversations, listingTitle: listings.title }).from(conversations).innerJoin(listings, eq(conversations.listingId, listings.id));
    const rows = scope ? await base.where(scope).orderBy(desc(conversations.createdAt)) : await base.orderBy(desc(conversations.createdAt));
    return Response.json({ conversations: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to contact a seller." }, { status: 401 });
    const { listingId } = await request.json() as { listingId?: string };
    if (!listingId) return Response.json({ error: "Listing is required." }, { status: 400 });
    const db = getDb();
    const buyer = await ensureUser(db, identity.clerkId);
    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing || listing.status !== "active") return Response.json({ error: "Listing not found." }, { status: 404 });
    if (listing.sellerId === buyer.id) return Response.json({ error: "This is your own listing." }, { status: 400 });
    const [existing] = await db.select().from(conversations).where(and(eq(conversations.listingId, listingId), eq(conversations.buyerId, buyer.id))).limit(1);
    if (existing) return Response.json({ conversation: existing });
    const conversation = { id: crypto.randomUUID(), listingId, buyerId: buyer.id, sellerId: listing.sellerId, createdAt: new Date().toISOString() };
    await db.insert(conversations).values(conversation);
    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
