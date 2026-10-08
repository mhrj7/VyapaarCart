import { asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { categories } from "../../../db/schema";
import { routeError } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ categories: await getDb().select().from(categories).orderBy(asc(categories.name)) });
  } catch (error) { return routeError(error); }
}
