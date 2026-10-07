import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders, shipmentEvents, shipments } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { nextShipmentStep, shipmentMessage } from "../../../../lib/delivery";
import { ensureUser, routeError } from "../../../../lib/marketplace";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to update a shipment." }, { status: 401 });
    const { id } = await params;
    const db = getDb();
    const seller = await ensureUser(db, identity.clerkId);
    const [record] = await db.select({ shipment: shipments, order: orders }).from(shipments).innerJoin(orders, eq(shipments.orderId, orders.id)).where(and(eq(shipments.id, id), eq(orders.sellerId, seller.id))).limit(1);
    if (!record) return Response.json({ error: "Shipment not found." }, { status: 404 });
    const next = nextShipmentStep(record.shipment.status);
    if (!next) return Response.json({ error: "This shipment is already complete." }, { status: 409 });

    const now = new Date().toISOString();
    const [shipment] = await db.update(shipments).set({ status: next, updatedAt: now }).where(eq(shipments.id, id)).returning();
    await db.insert(shipmentEvents).values({ id: crypto.randomUUID(), shipmentId: id, status: next, message: shipmentMessage(next), occurredAt: now });
    if (next === "delivered") await db.update(orders).set({ status: "completed", updatedAt: now }).where(eq(orders.id, record.order.id));
    return Response.json({ shipment, next });
  } catch (error) {
    return routeError(error);
  }
}
