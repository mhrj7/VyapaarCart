import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { categories, productAttributes, productVariantAttributes, productVariants, products, stores } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { canManageSeller } from "../../../../../lib/authorization";
import { normalizeProductAttributes } from "../../../../../lib/product-attributes";
import { normalizeProductVariants } from "../../../../../lib/product-variants";

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
    const variantRows = ids.length ? await result.db.select().from(productVariants).where(inArray(productVariants.productId, ids)).orderBy(asc(productVariants.name)) : [];
    const variantIds = variantRows.map((variant) => variant.id);
    const variantAttributes = variantIds.length ? await result.db.select().from(productVariantAttributes).where(inArray(productVariantAttributes.variantId, variantIds)).orderBy(asc(productVariantAttributes.key)) : [];
    const attributesByVariant = new Map<string, { key: string; value: string }[]>();
    for (const attribute of variantAttributes) attributesByVariant.set(attribute.variantId, [...(attributesByVariant.get(attribute.variantId) ?? []), { key: attribute.key, value: attribute.value }]);
    const variantsByProduct = new Map<string, { id: string; name: string; sku: string; price: number; status: string; attributes: { key: string; value: string }[] }[]>();
    for (const variant of variantRows) variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), { ...variant, attributes: attributesByVariant.get(variant.id) ?? [] }]);
    return Response.json({ store: result.store, products: productRows.map((row) => ({ ...row.product, category: row.category, attributes: byProduct.get(row.product.id) ?? [], variants: variantsByProduct.get(row.product.id) ?? [] })) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerAccess(request, id);
    if (!result) return Response.json({ error: "Store not found." }, { status: 404 });
    const input = await request.json() as { title?: string; description?: string; price?: number; categoryId?: string; attributes?: unknown; variants?: unknown };
    const title = input.title?.trim().slice(0, 120);
    const description = input.description?.trim().slice(0, 800);
    const price = Number(input.price);
    const categoryId = input.categoryId?.trim();
    const attributes = normalizeProductAttributes(input.attributes);
    const variants = normalizeProductVariants(input.variants);
    if (!title || !description || !categoryId || attributes === null || variants === null || !Number.isSafeInteger(price) || price < 1) return Response.json({ error: "Add a product title, category, description, valid base price, attributes, and at least one valid variant." }, { status: 400 });
    const [category] = await result.db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (!category) return Response.json({ error: "Choose a valid category." }, { status: 400 });
    const now = new Date().toISOString();
    const product = { id: crypto.randomUUID(), storeId: id, categoryId, title, description, price, status: "active", createdAt: now, updatedAt: now };
    await result.db.insert(products).values(product);
    if (attributes.length) await result.db.insert(productAttributes).values(attributes.map((attribute) => ({ ...attribute, productId: product.id, createdAt: now })));
    const rows = variants.map((variant) => ({ id: crypto.randomUUID(), productId: product.id, name: variant.name, sku: variant.sku, price: variant.price, status: "active", createdAt: now, updatedAt: now, attributes: variant.attributes }));
    try {
      await result.db.insert(productVariants).values(rows.map((variant) => ({ id: variant.id, productId: variant.productId, name: variant.name, sku: variant.sku, price: variant.price, status: variant.status, createdAt: variant.createdAt, updatedAt: variant.updatedAt })));
      const attributeRows = rows.flatMap((variant) => variant.attributes.map((attribute) => ({ ...attribute, variantId: variant.id, createdAt: now })));
      if (attributeRows.length) await result.db.insert(productVariantAttributes).values(attributeRows);
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("idx_product_variants_sku")) return Response.json({ error: "A variant SKU is already in use." }, { status: 409 });
      throw error;
    }
    return Response.json({ product: { ...product, category, attributes, variants: rows } }, { status: 201 });
  } catch (error) { return routeError(error); }
}
