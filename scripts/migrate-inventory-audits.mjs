import { readFile } from "node:fs/promises";
import postgres from "postgres";
if (!process.env.DATABASE_URL_UNPOOLED) throw Error("Set the direct database URL for migration.");
const client = postgres(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
try {
  const migration = await readFile(new URL("../drizzle/0009_inventory_audits.sql", import.meta.url), "utf8");
  await client.begin(async tx => { await tx.unsafe("SET LOCAL lock_timeout = '5s'"); await tx.unsafe(migration); });
  const result = await client`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name = 'inventory_audits'`;
  if (result[0].count !== 1) throw Error("Inventory audit migration verification failed.");
  console.log("Inventory audit table verified.");
} finally { await client.end(); }
