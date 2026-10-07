import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { listings } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { ensureUser, routeError, serializeListing } from "../../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to see your listings." }, { status: 401 });
    const db = getDb();
    const user = await ensureUser(db, identity.clerkId);
    const rows = await db.select().from(listings).where(eq(listings.sellerId, user.id)).orderBy(desc(listings.createdAt));
    return Response.json({ listings: rows.map((listing) => serializeListing(listing, user.displayName)) });
  } catch (error) {
    return routeError(error);
  }
}
