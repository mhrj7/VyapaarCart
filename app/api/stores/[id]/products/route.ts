import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { storeProducts, stores } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { canManageSeller } from "../../../../../lib/authorization";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function ownerAccess(request: Request, storeId: string) {
  const identity = await requireUser(request);
  if (!identity) return null;
  const db = getDb();
  const actor = await actorFor(db, identity.clerkId);
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  return store && canManageSeller(actor, store.ownerId) ? { db, store } : null;
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerAccess(request, id);
    if (!result) return Response.json({ error: "Store not found." }, { status: 404 });
    const products = await result.db.select().from(storeProducts).where(eq(storeProducts.storeId, id)).orderBy(desc(storeProducts.createdAt));
    return Response.json({ store: result.store, products });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerAccess(request, id);
    if (!result) return Response.json({ error: "Store not found." }, { status: 404 });
    const input = await request.json() as { title?: string; description?: string; price?: number };
    const title = input.title?.trim().slice(0, 120);
    const description = input.description?.trim().slice(0, 800);
    const price = Number(input.price);
    if (!title || !description || !Number.isSafeInteger(price) || price < 1) return Response.json({ error: "Add a product title, description, and valid price." }, { status: 400 });
    const now = new Date().toISOString();
    const product = { id: crypto.randomUUID(), storeId: id, title, description, price, status: "active", createdAt: now, updatedAt: now };
    await result.db.insert(storeProducts).values(product);
    return Response.json({ product }, { status: 201 });
  } catch (error) { return routeError(error); }
}
