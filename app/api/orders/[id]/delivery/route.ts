import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { orders } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { ensureUser, routeError } from "../../../../../lib/marketplace";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
type Input = { name?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; pincode?: string };

export async function PUT(request: Request, { params }: Context) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to set delivery details." }, { status: 401 });
    const input = await request.json() as Input;
    if (![input.name, input.email, input.phone, input.address, input.city, input.state, input.pincode].every((value) => value?.trim()) || !/^\d{6}$/.test(input.pincode || "") || (input.phone || "").replace(/\D/g, "").length < 10) {
      return Response.json({ error: "Enter a full address, a 6-digit pincode and a 10-digit phone number." }, { status: 400 });
    }
    const { id } = await params;
    const db = getDb();
    const buyer = await ensureUser(db, identity.clerkId);
    const [order] = await db.update(orders).set({ shippingName: input.name!.trim(), shippingEmail: input.email!.trim(), shippingPhone: input.phone!.trim(), shippingAddress: input.address!.trim(), shippingCity: input.city!.trim(), shippingState: input.state!.trim(), shippingPincode: input.pincode!.trim(), updatedAt: new Date().toISOString() }).where(and(eq(orders.id, id), eq(orders.buyerId, buyer.id))).returning();
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json({ order });
  } catch (error) { return routeError(error); }
}
