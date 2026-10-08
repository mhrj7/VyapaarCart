import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { categories, productAttributes, products, stores } from "../../../db/schema";
import { routeError } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim().slice(0, 100);
    const category = params.get("category")?.trim().slice(0, 60);
    const attributeKey = params.get("attributeKey")?.trim().toLowerCase().slice(0, 40);
    const attributeValue = params.get("attributeValue")?.trim().slice(0, 120);
    const db = getDb();
    const conditions = [eq(products.status, "active"), eq(stores.isPublic, true)];
    if (query) conditions.push(ilike(products.title, `%${query}%`));
    if (category) conditions.push(eq(categories.slug, category));
    let rows = await db.select({ product: products, store: stores, category: categories }).from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions)).orderBy(desc(products.createdAt));
    const ids = rows.map((row) => row.product.id);
    const allAttributes = ids.length ? await db.select().from(productAttributes).where(inArray(productAttributes.productId, ids)).orderBy(asc(productAttributes.key)) : [];
    const grouped = new Map<string, { key: string; value: string }[]>();
    for (const attribute of allAttributes) grouped.set(attribute.productId, [...(grouped.get(attribute.productId) ?? []), { key: attribute.key, value: attribute.value }]);
    if (attributeKey && attributeValue) rows = rows.filter((row) => grouped.get(row.product.id)?.some((attribute) => attribute.key === attributeKey && attribute.value.toLowerCase() === attributeValue.toLowerCase()));
    return Response.json({ products: rows.map((row) => ({ ...row.product, store: { id: row.store.id, name: row.store.name, slug: row.store.slug, city: row.store.city }, category: { id: row.category.id, name: row.category.name, slug: row.category.slug }, attributes: grouped.get(row.product.id) ?? [] })) });
  } catch (error) { return routeError(error); }
}
