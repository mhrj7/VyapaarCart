import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { ensureUser, routeError } from "../../../../lib/marketplace";

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
    const user = await ensureUser(db, identity.clerkId);
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const sellerCanUpdate = order.sellerId === user.id && status && sellerStatuses.has(status);
    const buyerCanCancel = order.buyerId === user.id && status === "cancelled";
    if (!sellerCanUpdate && !buyerCanCancel) return Response.json({ error: "You cannot make that order update." }, { status: 403 });
    const [updated] = await db.update(orders).set({ status: status!, updatedAt: new Date().toISOString() }).where(and(eq(orders.id, id), eq(order.sellerId === user.id ? orders.sellerId : orders.buyerId, user.id))).returning();
    return Response.json({ order: updated });
  } catch (error) {
    return routeError(error);
  }
}
