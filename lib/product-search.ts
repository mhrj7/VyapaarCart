import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { categories, productAttributes, productImages, products, stores } from "../db/schema";

export class SearchInputError extends Error {}

export function parseProductSearch(params: URLSearchParams) {
  const text = (key: string, max: number) => {
    const value = (params.get(key) ?? "").trim();
    if (value.length > max) throw new SearchInputError(`${key} must be at most ${max} characters.`);
    return value;
  };
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    if (raw === null || raw === "") return fallback;
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) {
      throw new SearchInputError(`${key} must be an integer from ${min} to ${max}.`);
    }
    return Number(raw);
  };
  const attributeKey = text("attributeKey", 40).toLowerCase();
  const attributeValue = text("attributeValue", 120);
  if (Boolean(attributeKey) !== Boolean(attributeValue)) throw new SearchInputError("Supply both attributeKey and attributeValue.");
  return { q: text("q", 100), category: text("category", 60), seller: integer("seller", 0, 1, 2147483647),
    limit: integer("limit", 24, 1, 48), offset: integer("offset", 0, 0, 10000), attributeKey, attributeValue };
}

// Keep identical to the GIN index in schema.ts and migration 0007.
export const productSearchVector = sql`(setweight(to_tsvector('english', ${products.title}), 'A') || setweight(to_tsvector('english', ${products.description}), 'B'))`;

export async function searchProducts(input: ReturnType<typeof parseProductSearch>) {
  const db = getDb();
  const conditions = [eq(products.status, "active"), eq(stores.isPublic, true)];
  const searchQuery = sql`websearch_to_tsquery('english', ${input.q})`;
  if (input.q) conditions.push(sql`${productSearchVector} @@ ${searchQuery}`);
  if (input.category) conditions.push(eq(categories.slug, input.category));
  if (input.seller) conditions.push(eq(stores.ownerId, input.seller));
  if (input.attributeKey) conditions.push(sql`exists (select 1 from ${productAttributes} where ${productAttributes.productId} = ${products.id} and ${productAttributes.key} = ${input.attributeKey} and lower(${productAttributes.value}) = lower(${input.attributeValue}))`);
  const rank = input.q ? sql<number>`ts_rank_cd(${productSearchVector}, ${searchQuery})` : sql<number>`0`;
  const rows = await db.select({ product: products, store: { id: stores.id, name: stores.name, slug: stores.slug, city: stores.city, sellerId: stores.ownerId }, category: { id: categories.id, name: categories.name, slug: categories.slug }, rank })
    .from(products).innerJoin(stores, eq(products.storeId, stores.id)).innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions)).orderBy(desc(rank), desc(products.createdAt), asc(products.id)).limit(input.limit + 1).offset(input.offset);
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  const ids = page.map((row) => row.product.id);
  const attributes = ids.length ? await db.select().from(productAttributes).where(inArray(productAttributes.productId, ids)).orderBy(asc(productAttributes.key)) : [];
  const media = ids.length ? await db.select().from(productImages).where(and(inArray(productImages.productId, ids), eq(productImages.status, "active"))).orderBy(asc(productImages.position), asc(productImages.id)) : [];
  return { products: page.map((row) => ({ ...row.product, store: row.store, category: row.category, relevance: Number(row.rank),
    attributes: attributes.filter((a) => a.productId === row.product.id).map(({ key, value }) => ({ key, value })),
    images: media.filter((image) => image.productId === row.product.id).map(({ id, objectKey, altText }) => ({ id, objectKey, altText })) })),
    pagination: { limit: input.limit, offset: input.offset, hasMore, nextOffset: hasMore && input.offset + input.limit <= 10000 ? input.offset + input.limit : null } };
}
