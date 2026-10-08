import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError } from "../../../../lib/marketplace";
import { canManageSeller, canManageOwnRecord } from "../../../../lib/authorization";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const sellerStatuses = new Set(["accepted", "cancelled"]);

export async function PATCH(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to manage orders." }, { status: 401 });
    const { id } = await params;
    const { status } = await request.json() as { status?: string };
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const sellerCanUpdate = Boolean(status && sellerStatuses.has(status) && canManageSeller(actor, order.sellerId));
    const buyerCanCancel = status === "cancelled" && canManageOwnRecord(actor, order.buyerId);
    if (!sellerCanUpdate && !buyerCanCancel) return Response.json({ error: "You cannot make that order update." }, { status: 403 });
    const ownerId = sellerCanUpdate ? order.sellerId : order.buyerId;
    const [updated] = await db.update(orders).set({ status: status!, updatedAt: new Date().toISOString() }).where(and(eq(orders.id, id), eq(sellerCanUpdate ? orders.sellerId : orders.buyerId, ownerId))).returning();
    return Response.json({ order: updated });
  } catch (error) {
    return routeError(error);
  }
}
