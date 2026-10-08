import { readFile } from "node:fs/promises";
import postgres from "postgres";

// Concurrent index builds must not run in a transaction. Use the direct URL.
if (!process.env.DATABASE_URL_UNPOOLED) throw new Error("Set DATABASE_URL_UNPOOLED for the intended database.");
const client = postgres(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
try {
  const migration = await readFile(new URL("../drizzle/0007_product_search.sql", import.meta.url), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) await client.unsafe(statement);
  const rows = await client`select c.relname, i.indisvalid from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname in ('idx_products_search', 'idx_products_browse')`;
  if (rows.length !== 2 || rows.some((row) => !row.indisvalid)) throw new Error("Search indexes are missing or invalid. Inspect before retrying.");
  console.log("Both product search indexes are valid.");
} finally { await client.end(); }
