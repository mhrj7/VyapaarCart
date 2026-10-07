import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { getDb } from "../../../../db";
import { listings, users } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { isListingImageUrl, requireListingOwner, routeError, serializeListing } from "../../../../lib/marketplace";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    const { id } = await params;
    const db = getDb();
    const [row] = await db.select({ listing: listings, sellerName: users.displayName }).from(listings).innerJoin(users, eq(listings.sellerId, users.id)).where(eq(listings.id, id)).limit(1);
    if (!row || row.listing.status !== "active") return Response.json({ error: "Listing not found." }, { status: 404 });
    return Response.json({ listing: serializeListing(row.listing, row.sellerName) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to manage listings." }, { status: 401 });
    const { id } = await params;
    const db = getDb();
    const listing = await requireListingOwner(db, id, identity.clerkId);
    if (!listing) return Response.json({ error: "You can only edit your own listing." }, { status: 403 });
    const payload = await request.json() as Record<string, unknown>;
    const values: Record<string, string | number> = { updatedAt: new Date().toISOString() };
    if (typeof payload.title === "string" && payload.title.trim()) values.title = payload.title.trim().slice(0, 100);
    if (typeof payload.description === "string" && payload.description.trim()) values.description = payload.description.trim().slice(0, 1500);
    if (typeof payload.city === "string" && payload.city.trim()) values.city = payload.city.trim().slice(0, 80);
    if (typeof payload.conditionLabel === "string" && payload.conditionLabel.trim()) values.conditionLabel = payload.conditionLabel.trim().slice(0, 30);
    if (typeof payload.status === "string" && ["active", "sold", "archived"].includes(payload.status)) values.status = payload.status;
    if (payload.price !== undefined && Number.isSafeInteger(Number(payload.price)) && Number(payload.price) > 0) values.price = Number(payload.price);
    const [updated] = await db.update(listings).set(values).where(eq(listings.id, id)).returning();
    return Response.json({ listing: serializeListing(updated) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to manage listings." }, { status: 401 });
    const { id } = await params;
    const db = getDb();
    const listing = await requireListingOwner(db, id, identity.clerkId);
    if (!listing) return Response.json({ error: "You can only delete your own listing." }, { status: 403 });
    await db.delete(listings).where(eq(listings.id, id));
    if (listing.imageKey && isListingImageUrl(listing.imageKey)) await del(listing.imageKey);
    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
