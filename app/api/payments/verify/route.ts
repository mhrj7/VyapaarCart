import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { ensureUser, routeError } from "../../../../lib/marketplace";

export const dynamic = "force-dynamic";

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to verify payment." }, { status: 401 });
    const { marketplaceOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await request.json() as Record<string, string | undefined>;
    if (!marketplaceOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return Response.json({ error: "Payment response is incomplete." }, { status: 400 });
    const db = getDb();
    const user = await ensureUser(db, identity.clerkId);
    const [order] = await db.select().from(orders).where(and(eq(orders.id, marketplaceOrderId), eq(orders.buyerId, user.id))).limit(1);
    if (!order || order.razorpayOrderId !== razorpayOrderId) return Response.json({ error: "Payment order does not match." }, { status: 400 });
    const secret = process.env.RAZORPAY_TEST_KEY_SECRET;
    if (!secret) return Response.json({ error: "Razorpay test mode is not configured." }, { status: 503 });
    const expected = await sign(`${razorpayOrderId}|${razorpayPaymentId}`, secret);
    if (expected !== razorpaySignature) return Response.json({ error: "Payment signature could not be verified." }, { status: 400 });
    const [updated] = await db.update(orders).set({ paymentStatus: "paid", razorpayPaymentId, updatedAt: new Date().toISOString() }).where(eq(orders.id, order.id)).returning();
    return Response.json({ order: updated });
  } catch (error) {
    return routeError(error);
  }
}
