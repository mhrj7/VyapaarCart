import { readFile } from "node:fs/promises";
import postgres from "postgres";
if (!process.env.DATABASE_URL_UNPOOLED) throw Error("Set the direct database URL for migration.");
const client = postgres(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
try {
  const migration = await readFile(new URL("../drizzle/0010_inventory_reservations.sql", import.meta.url), "utf8");
  await client.begin(async tx => { await tx.unsafe("SET LOCAL lock_timeout = '5s'"); await tx.unsafe(migration); });
  const result = await client`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('inventory_reservations', 'inventory_reservation_allocations')`;
  if (result[0].count !== 2) throw Error("Reservation migration verification failed.");
  console.log("Reservation tables, creation function, and stock protection trigger installed.");
} finally { await client.end(); }
