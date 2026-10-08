import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { getDb } from "../db";
import { categories, productAttributes, products, stores, users } from "../db/schema";
import { GET } from "../app/api/products/route";
import { productSearchVector } from "../lib/product-search";

test("product search: SQL relevance, all filters, pagination, visibility and index", { skip: process.env.RUN_SEARCH_INTEGRATION !== "1" }, async () => {
  assert.match(process.env.DATABASE_URL ?? "", /@(db|localhost|127\.0\.0\.1)(:|\/)/);
  const db = getDb();
  const suffix = crypto.randomUUID();
  const term = `quartz${suffix.replaceAll("-", "")}`;
  const categoryIds = [crypto.randomUUID(), crypto.randomUUID()];
  const storeIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const productIds = Array.from({ length: 5 }, () => crypto.randomUUID());
  const ownerIds: number[] = [];
  const request = async (query: string) => {
    const response = await GET(new Request(`http://localhost/api/products?${query}`));
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    // Concurrent migration cannot run in a transaction. This DB is local-only.
    const migration = await readFile(new URL("../drizzle/0007_product_search.sql", import.meta.url), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) await db.execute(sql.raw(statement));
    for (let i = 0; i < 2; i++) {
      const [user] = await db.insert(users).values({ clerkId: `search-${suffix}-${i}` }).returning(); ownerIds.push(user.id);
      await db.insert(categories).values({ id: categoryIds[i], name: `Search ${i}`, slug: `search-${suffix}-${i}` });
    }
    for (let i = 0; i < 3; i++) await db.insert(stores).values({ id: storeIds[i], ownerId: ownerIds[i === 1 ? 1 : 0], name: `Search store ${i}`, slug: `${suffix}-${i}`, description: "Local test", city: "Bengaluru", isPublic: i !== 2 });
    const fixture = [
      { title: `${term} phone`, description: "Portable device", store: 0, category: 0, status: "active" },
      { title: "Portable device", description: `${term} phone`, store: 0, category: 0, status: "active" },
      { title: `${term} headphones`, description: "Wireless", store: 1, category: 1, status: "active" },
      { title: `${term} secret`, description: "Private store", store: 2, category: 0, status: "active" },
      { title: `${term} archived`, description: "Hidden", store: 0, category: 0, status: "archived" },
    ];
    for (const [i, f] of fixture.entries()) await db.insert(products).values({ id: productIds[i], storeId: storeIds[f.store], categoryId: categoryIds[f.category], title: f.title, description: f.description, price: 100, status: f.status });
    await db.insert(productAttributes).values({ productId: productIds[1], key: "brand", value: "Acme" });
    await db.execute(sql`insert into products (id, store_id, category_id, title, description, price)
      select ${suffix} || '-bulk-' || n, ${storeIds[0]}, ${categoryIds[0]}, 'Unrelated item ' || n, 'Unrelated catalog fixture', 100 from generate_series(1, 3000) n`);
    await db.execute(sql`analyze products`);
    const found = await request(`q=${term}`);
    assert.equal(found.products.length, 3);
    assert.equal(found.products[0].relevance > found.products.find((p: { id: string }) => p.id === productIds[1]).relevance, true);
    assert.equal(found.products.some((p: { id: string }) => [productIds[3], productIds[4]].includes(p.id)), false);
    const combined = await request(`q=${term}&category=search-${suffix}-0&seller=${ownerIds[0]}`);
    assert.deepEqual(new Set(combined.products.map((p: { id: string }) => p.id)), new Set(productIds.slice(0, 2)));
    const seller = await request(`q=${term}&seller=${ownerIds[1]}`); assert.equal(seller.products[0].id, productIds[2]); assert.equal(seller.products.length, 1);
    const attribute = await request(`q=${term}&attributeKey=brand&attributeValue=acme&limit=1`); assert.equal(attribute.products[0].id, productIds[1]);
    const first = await request(`q=${term}&limit=1`); assert.equal(first.pagination.nextOffset, 1);
    const second = await request(`q=${term}&limit=1&offset=1`); assert.notEqual(first.products[0].id, second.products[0].id);
    assert.equal((await request(`q=${term}&category=missing`)).products.length, 0);
    assert.equal((await request("category=missing")).products.length, 0);
    const browse = await request(`seller=${ownerIds[1]}`);
    assert.equal(browse.products.length, 1);
    assert.equal(browse.products[0].id, productIds[2]);
    assert.equal((await request(`q=${term}&seller=2147483647`)).products.length, 0);
    assert.equal((await request(`q=${term}%20phones`)).products.length, 2);
    assert.equal((await request("q=%25%27%3B--")).products.length, 0);
    assert.equal((await GET(new Request("http://localhost/api/products?limit=999"))).status, 400);
    // Edits are reflected without a manual reindex or sync job.
    await db.update(products).set({ title: "Changed", description: "Changed" }).where(eq(products.id, productIds[0]));
    assert.equal((await request(`q=${term}`)).products.length, 2);
    const indexes = await (db as ReturnType<typeof drizzlePostgres>).execute(sql`select indexname from pg_indexes where tablename = 'products' and indexname = 'idx_products_search'`);
    assert.equal(indexes.length, 1);
    const plan = await (db as ReturnType<typeof drizzlePostgres>).execute(sql`explain select id from products where ${productSearchVector} @@ websearch_to_tsquery('english', ${term})`);
    assert.match(JSON.stringify(plan), /idx_products_search/);
  } finally {
    await db.delete(products).where(inArray(products.storeId, storeIds));
    await db.delete(stores).where(inArray(stores.id, storeIds));
    await db.delete(categories).where(inArray(categories.id, categoryIds));
    if (ownerIds.length) await db.delete(users).where(inArray(users.id, ownerIds));
    await (db as ReturnType<typeof drizzlePostgres>).$client.end();
  }
});
