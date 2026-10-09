import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { productVariants, products, stores, warehouses, warehouseStock } from "../db/schema";
import { Actor, canManageSeller } from "./authorization";

export async function accessibleStore(actor: Actor, storeId: string) {
  const [store] = await getDb().select().from(stores).where(eq(stores.id, storeId)).limit(1);
  return store && canManageSeller(actor, store.ownerId) ? store : null;
}

export async function warehouseInventory(actor: Actor, storeId: string, warehouseId: string) {
  if (!await accessibleStore(actor, storeId)) return null;
  const db = getDb();
  const [warehouse] = await db.select().from(warehouses).where(and(eq(warehouses.id, warehouseId), eq(warehouses.storeId, storeId))).limit(1);
  if (!warehouse) return null;
  const inventory = await db.select({ variantId: productVariants.id, sku: productVariants.sku, name: productVariants.name, title: products.title,
    quantity: sql<number>`coalesce(${warehouseStock.quantity}, 0)`, version: sql<number>`coalesce(${warehouseStock.version}, 0)` })
    .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(warehouseStock, and(eq(warehouseStock.variantId, productVariants.id), eq(warehouseStock.warehouseId, warehouseId)))
    .where(eq(products.storeId, storeId)).orderBy(asc(productVariants.sku));
  return { warehouse, inventory };
}

export async function setWarehouseStock(actor: Actor, storeId: string, warehouseId: string, input: { variantId: string; quantity: number; version: number }): Promise<typeof warehouseStock.$inferSelect | "not_found" | "conflict"> {
  if (!await accessibleStore(actor, storeId)) return "not_found";
  const db = getDb();
  const [warehouse] = await db.select().from(warehouses).where(and(eq(warehouses.id, warehouseId), eq(warehouses.storeId, storeId))).limit(1);
  const [variant] = await db.select({ id: productVariants.id }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(products.storeId, storeId), eq(productVariants.id, input.variantId))).limit(1);
  if (!warehouse || !variant) return "not_found";
  // Compare-and-set is atomic. Version 0 represents an as-yet unrecorded SKU.
  const rows = input.version === 0
    ? await db.insert(warehouseStock).values({ warehouseId, variantId: input.variantId, quantity: input.quantity }).onConflictDoNothing().returning()
    : await db.update(warehouseStock).set({ quantity: input.quantity, version: sql`${warehouseStock.version} + 1`, updatedAt: new Date().toISOString() })
      .where(and(eq(warehouseStock.warehouseId, warehouseId), eq(warehouseStock.variantId, input.variantId), eq(warehouseStock.version, input.version))).returning();
  return rows[0] ?? "conflict";
}
