import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { stores } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { actorFor, routeError } from "../../../lib/marketplace";
import { canOperateStore, sellerAccountId } from "../../../lib/authorization";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

export async function GET() {
  try {
    const rows = await getDb().select().from(stores).where(eq(stores.isPublic, true)).orderBy(desc(stores.createdAt));
    return Response.json({ stores: rows });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to create a store." }, { status: 401 });
    const input = await request.json() as { name?: string; description?: string; city?: string };
    const name = input.name?.trim().slice(0, 80);
    const description = input.description?.trim().slice(0, 500);
    const city = input.city?.trim().slice(0, 60);
    if (!name || !description || !city) return Response.json({ error: "Add a store name, description, and city." }, { status: 400 });
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    if (!canOperateStore(actor)) return Response.json({ error: "Seller approval is required before you can create a public store." }, { status: 403 });
    const ownerId = sellerAccountId(actor);
    if (!ownerId) return Response.json({ error: "A seller account is required." }, { status: 403 });
    const now = new Date().toISOString();
    const store = { id: crypto.randomUUID(), ownerId, name, description, city, slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`, isPublic: true, createdAt: now, updatedAt: now };
    await db.insert(stores).values(store);
    return Response.json({ store }, { status: 201 });
  } catch (error) { return routeError(error); }
}
