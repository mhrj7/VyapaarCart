import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { listings } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError, serializeListing } from "../../../../lib/marketplace";
import { canOperateStore, sellerAccountId } from "../../../../lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to see your listings." }, { status: 401 });
    const db = getDb();
    const user = await actorFor(db, identity.clerkId);
    const sellerId = sellerAccountId(user);
    if (!sellerId || !canOperateStore(user)) return Response.json({ error: "Seller approval is required before you can view seller listings." }, { status: 403 });
    const rows = await db.select().from(listings).where(eq(listings.sellerId, sellerId)).orderBy(desc(listings.createdAt));
    return Response.json({ listings: rows.map((listing) => serializeListing(listing)) });
  } catch (error) {
    return routeError(error);
  }
}
