import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { warehouses } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { accessibleStore } from "../../../../../lib/warehouse-service";
import { warehouseInput } from "../../../../../lib/warehouse-input";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request); if (!identity) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params; const db = getDb(); const actor = await actorFor(db, identity.clerkId);
    if (!await accessibleStore(actor, id)) return Response.json({ error: "Store not found." }, { status: 404 });
    return Response.json({ warehouses: await db.select().from(warehouses).where(eq(warehouses.storeId, id)).orderBy(asc(warehouses.name), asc(warehouses.id)) });
  } catch (error) { return routeError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request); if (!identity) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params; const db = getDb(); const actor = await actorFor(db, identity.clerkId);
    if (!await accessibleStore(actor, id)) return Response.json({ error: "Store not found." }, { status: 404 });
    const input = warehouseInput(await request.json().catch(() => null));
    if (!input) return Response.json({ error: "Enter a name, address, city and six-digit postcode." }, { status: 400 });
    const [warehouse] = await db.insert(warehouses).values({ ...input, id: crypto.randomUUID(), storeId: id }).returning();
    return Response.json({ warehouse }, { status: 201 });
  } catch (error) { return routeError(error); }
}
