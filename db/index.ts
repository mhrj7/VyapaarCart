import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

let database: Database | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Database is not configured.");
  }
  if (!database) {
    const hostname = new URL(connectionString).hostname;
    const isLocalPostgres =
      hostname === "db" || hostname === "localhost" || hostname === "127.0.0.1";
    database = isLocalPostgres
      ? drizzlePostgres(postgres(connectionString), { schema })
      : drizzleNeon(neon(connectionString), { schema });
  }
  return database;
}
