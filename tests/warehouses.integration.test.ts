import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { getDb } from "../db";
import { categories, products, productVariants, stores, users, warehouses, warehouseStock } from "../db/schema";
import { Actor } from "../lib/authorization";
import { accessibleStore, setWarehouseStock, warehouseInventory } from "../lib/warehouse-service";

test("warehouse SQL: separate SKU/location balances, seller isolation, persistence and concurrent conflict", { skip: process.env.RUN_WAREHOUSE_INTEGRATION !== "1" }, async () => {
  assert.match(process.env.DATABASE_URL ?? "", /@(db|localhost|127\.0\.0\.1)(:|\/)/);
  const db = getDb(); const tag = crypto.randomUUID(); const ownerIds: number[] = [];
  const storeIds = [crypto.randomUUID(), crypto.randomUUID()]; const warehouseIds = [crypto.randomUUID(), crypto.randomUUID()];
  const variantIds = [crypto.randomUUID(), crypto.randomUUID()]; const productIds = [crypto.randomUUID(), crypto.randomUUID()];
  try {
    await db.execute(sql.raw(await readFile(new URL("../drizzle/0008_warehouses.sql", import.meta.url), "utf8")));
    for (let i = 0; i < 2; i++) {
      const [u] = await db.insert(users).values({ clerkId: `${tag}-${i}`, role: "seller", sellerApprovalStatus: "approved" }).returning(); ownerIds.push(u.id);
      await db.insert(stores).values({ id: storeIds[i], ownerId: u.id, name: "Local warehouse test", slug: `${tag}-${i}`, city: "Test", description: "Local test" });
    }
    await db.insert(categories).values({ id: tag, name: "Test", slug: tag });
    for (let i = 0; i < 2; i++) {
      await db.insert(products).values({ id: productIds[i], storeId: storeIds[i], categoryId: tag, title: "Local product", description: "Test", price: 100 });
      await db.insert(productVariants).values({ id: variantIds[i], productId: productIds[i], name: "Standard", sku: `${tag}-${i}`, price: 100 });
      await db.insert(warehouses).values({ id: warehouseIds[i], storeId: storeIds[0], name: `Warehouse ${i}`, city: "Test", address: "Test fixture", postcode: "560001" });
    }
    const actor: Actor = { id: ownerIds[0], clerkId: `${tag}-0`, role: "seller", staffForSellerId: null, sellerApprovalStatus: "approved" };
    const other: Actor = { ...actor, id: ownerIds[1] };
    assert.equal(await accessibleStore(other, storeIds[0]), null);
    assert.equal(await warehouseInventory(other, storeIds[0], warehouseIds[0]), null);
    assert.equal(await setWarehouseStock(other, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 10, version: 0 }), "not_found");
    assert.equal(await setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[1], quantity: 10, version: 0 }), "not_found");
    const first = await setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 10, version: 0 });
    assert.equal(typeof first, "object");
    await setWarehouseStock(actor, storeIds[0], warehouseIds[1], { variantId: variantIds[0], quantity: 7, version: 0 });
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.inventory[0].quantity, 10);
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[1]))?.inventory[0].quantity, 7);
    const attempts = await Promise.all([12, 14].map(quantity => setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity, version: 1 })));
    assert.equal(attempts.filter(x => x === "conflict").length, 1);
    assert.equal(attempts.filter(x => typeof x === "object").length, 1);
    assert.equal(await setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 4, version: 0 }), "conflict");
    await setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 0, version: 2 });
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.inventory[0].quantity, 0);
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[1]))?.inventory[0].quantity, 7);
    await assert.rejects(db.update(warehouseStock).set({ quantity: -1 }).where(eq(warehouseStock.warehouseId, warehouseIds[0])));
    const staff: Actor = { ...actor, id: -1, role: "seller_staff", staffForSellerId: ownerIds[0] };
    assert.ok(await accessibleStore(staff, storeIds[0]));
    assert.equal(await accessibleStore({ ...actor, sellerApprovalStatus: "pending" }, storeIds[0]), null);
  } finally {
    await db.delete(warehouseStock).where(inArray(warehouseStock.warehouseId, warehouseIds));
    await db.delete(warehouses).where(inArray(warehouses.id, warehouseIds));
    await db.delete(products).where(inArray(products.id, productIds));
    await db.delete(stores).where(inArray(stores.id, storeIds)); await db.delete(categories).where(eq(categories.id, tag));
    if (ownerIds.length) await db.delete(users).where(inArray(users.id, ownerIds));
    await (db as ReturnType<typeof drizzlePostgres>).$client.end();
  }
});
