import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { categories, productAttributes, products, stores } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { canManageSeller } from "../../../../../lib/authorization";
import { normalizeProductAttributes } from "../../../../../lib/product-attributes";

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
    const productRows = await result.db.select({ product: products, category: categories }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).where(eq(products.storeId, id)).orderBy(desc(products.createdAt));
    const ids = productRows.map((row) => row.product.id);
    const attributes = ids.length ? await result.db.select().from(productAttributes).where(inArray(productAttributes.productId, ids)).orderBy(asc(productAttributes.key)) : [];
    const byProduct = new Map<string, { key: string; value: string }[]>();
    for (const attribute of attributes) byProduct.set(attribute.productId, [...(byProduct.get(attribute.productId) ?? []), { key: attribute.key, value: attribute.value }]);
    return Response.json({ store: result.store, products: productRows.map((row) => ({ ...row.product, category: row.category, attributes: byProduct.get(row.product.id) ?? [] })) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerAccess(request, id);
    if (!result) return Response.json({ error: "Store not found." }, { status: 404 });
    const input = await request.json() as { title?: string; description?: string; price?: number; categoryId?: string; attributes?: unknown };
    const title = input.title?.trim().slice(0, 120);
    const description = input.description?.trim().slice(0, 800);
    const price = Number(input.price);
    const categoryId = input.categoryId?.trim();
    const attributes = normalizeProductAttributes(input.attributes);
    if (!title || !description || !categoryId || attributes === null || !Number.isSafeInteger(price) || price < 1) return Response.json({ error: "Add a product title, category, description, valid price, and valid attributes." }, { status: 400 });
    const [category] = await result.db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (!category) return Response.json({ error: "Choose a valid category." }, { status: 400 });
    const now = new Date().toISOString();
    const product = { id: crypto.randomUUID(), storeId: id, categoryId, title, description, price, status: "active", createdAt: now, updatedAt: now };
    await result.db.insert(products).values(product);
    if (attributes.length) await result.db.insert(productAttributes).values(attributes.map((attribute) => ({ ...attribute, productId: product.id, createdAt: now })));
    return Response.json({ product: { ...product, category, attributes } }, { status: 201 });
  } catch (error) { return routeError(error); }
}
