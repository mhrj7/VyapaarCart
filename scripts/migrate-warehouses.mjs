import { readFile } from "node:fs/promises";
import postgres from "postgres";
if (!process.env.DATABASE_URL_UNPOOLED) throw Error("Set the direct database URL for migration.");
const client = postgres(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
try {
  const migration = await readFile(new URL("../drizzle/0008_warehouses.sql", import.meta.url), "utf8");
  await client.begin(async tx => { await tx.unsafe("SET LOCAL lock_timeout = '5s'"); await tx.unsafe(migration); });
  const result = await client`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name in ('warehouses','warehouse_stock')`;
  if (result[0].count !== 2) throw Error("Warehouse migration verification failed.");
  console.log("Warehouse and per-SKU inventory tables verified.");
} finally { await client.end(); }
