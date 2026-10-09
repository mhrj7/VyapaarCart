import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { getDb } from "../db";
import { categories, inventoryAudits, products, productVariants, stores, users, warehouses, warehouseStock } from "../db/schema";
import { Actor } from "../lib/authorization";
import { accessibleStore, setWarehouseStock, warehouseInventory } from "../lib/warehouse-service";

test("warehouse SQL: separate SKU/location balances, seller isolation, persistence and concurrent conflict", { skip: process.env.RUN_WAREHOUSE_INTEGRATION !== "1" }, async () => {
  assert.match(process.env.DATABASE_URL ?? "", /@(db|localhost|127\.0\.0\.1)(:|\/)/);
  const db = getDb(); const tag = crypto.randomUUID(); const ownerIds: number[] = [];
  const storeIds = [crypto.randomUUID(), crypto.randomUUID()]; const warehouseIds = [crypto.randomUUID(), crypto.randomUUID()];
  const variantIds = [crypto.randomUUID(), crypto.randomUUID()]; const productIds = [crypto.randomUUID(), crypto.randomUUID()];
  try {
    await db.execute(sql.raw(await readFile(new URL("../drizzle/0008_warehouses.sql", import.meta.url), "utf8")));
    await db.execute(sql.raw(await readFile(new URL("../drizzle/0009_inventory_audits.sql", import.meta.url), "utf8")));
    await db.execute(sql.raw(await readFile(new URL("../drizzle/0010_inventory_reservations.sql", import.meta.url), "utf8")));
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
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.history[0].previousQuantity, 0);
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.history[0].quantity, 10);
    const attempts = await Promise.all([12, 14].map(quantity => setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity, version: 1 })));
    assert.equal(attempts.filter(x => x === "conflict").length, 1);
    assert.equal(attempts.filter(x => typeof x === "object").length, 1);
    assert.equal(await setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 4, version: 0 }), "conflict");
    await setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 0, version: 2 });
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.inventory[0].quantity, 0);
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[1]))?.inventory[0].quantity, 7);
    await assert.rejects(db.update(warehouseStock).set({ quantity: -1 }).where(eq(warehouseStock.warehouseId, warehouseIds[0])));
    const records = await db.select().from(inventoryAudits).where(eq(inventoryAudits.storeId, storeIds[0]));
    assert.equal(records.length, 4, "Rejected/stale writes create no audit records");
    assert.ok(records.every(a => a.actorId === actor.id && a.actorRole === "seller" && a.sku === `${tag}-0`));
    const zero = records.find(a => a.stockVersion === 3);
    assert.ok(zero && [12, 14].includes(zero.previousQuantity) && zero.quantity === 0);
    await assert.rejects(setWarehouseStock(actor, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 99, version: 3, reason: "" }));
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.inventory[0].quantity, 0, "Audit failure rolls back stock");
    assert.equal((await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.history.length, 3);
    const [staffUser] = await db.insert(users).values({ clerkId: `${tag}-staff`, role: "seller_staff", staffForSellerId: ownerIds[0], sellerApprovalStatus: "approved" }).returning();
    ownerIds.push(staffUser.id);
    const writeStaff: Actor = { ...actor, id: staffUser.id, clerkId: staffUser.clerkId, role: "seller_staff", staffForSellerId: actor.id };
    await setWarehouseStock(writeStaff, storeIds[0], warehouseIds[0], { variantId: variantIds[0], quantity: 5, version: 3, reason: "Stock count correction" });
    const staffAudit = (await warehouseInventory(actor, storeIds[0], warehouseIds[0]))?.history[0];
    assert.equal(staffAudit?.actorId, staffUser.id); assert.equal(staffAudit?.actorRole, "seller_staff"); assert.equal(staffAudit?.reason, "Stock count correction");
    const staff: Actor = { ...actor, id: -1, role: "seller_staff", staffForSellerId: ownerIds[0] };
    assert.ok(await accessibleStore(staff, storeIds[0]));
    assert.equal(await accessibleStore({ ...actor, sellerApprovalStatus: "pending" }, storeIds[0]), null);
  } finally {
    await db.delete(inventoryAudits).where(inArray(inventoryAudits.storeId, storeIds));
    await db.delete(warehouseStock).where(inArray(warehouseStock.warehouseId, warehouseIds));
    await db.delete(warehouses).where(inArray(warehouses.id, warehouseIds));
    await db.delete(products).where(inArray(products.id, productIds));
    await db.delete(stores).where(inArray(stores.id, storeIds)); await db.delete(categories).where(eq(categories.id, tag));
    if (ownerIds.length) await db.delete(users).where(inArray(users.id, ownerIds));
    await (db as ReturnType<typeof drizzlePostgres>).$client.end();
  }
});
