import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { stores } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError } from "../../../../lib/marketplace";
import { canOperateStore, sellerAccountId } from "../../../../lib/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to manage stores." }, { status: 401 });
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    if (!canOperateStore(actor)) return Response.json({ error: "Seller approval is required before you can manage stores." }, { status: 403 });
    const ownerId = sellerAccountId(actor);
    const rows = actor.role === "admin" ? await db.select().from(stores).orderBy(desc(stores.createdAt)) : await db.select().from(stores).where(eq(stores.ownerId, ownerId!)).orderBy(desc(stores.createdAt));
    return Response.json({ stores: rows });
  } catch (error) { return routeError(error); }
}
