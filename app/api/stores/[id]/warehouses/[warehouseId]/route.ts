import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { warehouses } from "../../../../../../db/schema";
import { requireUser } from "../../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../../lib/marketplace";
import { warehouseInput, stockInput } from "../../../../../../lib/warehouse-input";
import { accessibleStore, setWarehouseStock, warehouseInventory } from "../../../../../../lib/warehouse-service";
type Context = { params: Promise<{ id: string; warehouseId: string }> };
export const dynamic = "force-dynamic";
async function actor(request: Request) { const identity = await requireUser(request); return identity ? actorFor(getDb(), identity.clerkId) : null; }
export async function GET(request: Request, { params }: Context) {
  try { const user = await actor(request); if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { id, warehouseId } = await params; const data = await warehouseInventory(user, id, warehouseId);
    return data ? Response.json(data) : Response.json({ error: "Warehouse not found." }, { status: 404 });
  } catch (error) { return routeError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try { const user = await actor(request); if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { id, warehouseId } = await params;
    if (!await accessibleStore(user, id)) return Response.json({ error: "Warehouse not found." }, { status: 404 });
    const input = warehouseInput(await request.json().catch(() => null));
    if (!input) return Response.json({ error: "Enter valid warehouse details." }, { status: 400 });
    const [warehouse] = await getDb().update(warehouses).set({ ...input, updatedAt: new Date().toISOString() }).where(and(eq(warehouses.id, warehouseId), eq(warehouses.storeId, id))).returning();
    return warehouse ? Response.json({ warehouse }) : Response.json({ error: "Warehouse not found." }, { status: 404 });
  } catch (error) { return routeError(error); }
}
export async function PUT(request: Request, { params }: Context) {
  try { const user = await actor(request); if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { id, warehouseId } = await params; const input = stockInput(await request.json().catch(() => null));
    if (!input) return Response.json({ error: "Enter a SKU, integer quantity from 0 to 1000000, and stock version." }, { status: 400 });
    const result = await setWarehouseStock(user, id, warehouseId, input);
    if (result === "not_found") return Response.json({ error: "Warehouse or SKU not found." }, { status: 404 });
    if (result === "conflict") return Response.json({ error: "Stock changed in another session. Reload and try again." }, { status: 409 });
    return Response.json({ stock: result });
  } catch (error) { return routeError(error); }
}
