import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Database is not configured.");
  }
  database ??= drizzle(neon(connectionString), { schema });
  return database;
}
