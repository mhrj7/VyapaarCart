import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sellerApprovalAudits, users } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError } from "../../../../lib/marketplace";
import { canApproveSellers } from "../../../../lib/authorization";

export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const identity = await requireUser(request);
  if (!identity) return null;
  const db = getDb();
  const actor = await actorFor(db, identity.clerkId);
  return canApproveSellers(actor) ? { db, actor } : null;
}

export async function GET(request: Request) {
  try {
    const result = await requireAdmin(request);
    if (!result) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const sellers = await result.db.select({ id: users.id, displayName: users.displayName, status: users.sellerApprovalStatus, requestedAt: users.sellerApprovalRequestedAt }).from(users).where(eq(users.sellerApprovalStatus, "pending")).orderBy(desc(users.sellerApprovalRequestedAt));
    const audits = await result.db.select().from(sellerApprovalAudits).orderBy(desc(sellerApprovalAudits.createdAt)).limit(30);
    return Response.json({ sellers, audits });
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request) {
  try {
    const result = await requireAdmin(request);
    if (!result) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const { sellerId, decision } = await request.json() as { sellerId?: number; decision?: "approved" | "rejected" };
    if (!Number.isInteger(sellerId) || (decision !== "approved" && decision !== "rejected")) return Response.json({ error: "Choose a seller and an approval decision." }, { status: 400 });
    const [seller] = await result.db.select().from(users).where(eq(users.id, sellerId!)).limit(1);
    if (!seller || seller.sellerApprovalStatus !== "pending") return Response.json({ error: "This seller does not have a pending approval request." }, { status: 409 });
    const now = new Date().toISOString();
    await result.db.update(users).set({ role: decision === "approved" ? "seller" : "buyer", sellerApprovalStatus: decision, sellerApprovedAt: decision === "approved" ? now : null, sellerApprovedById: result.actor.id }).where(eq(users.id, seller.id));
    await result.db.insert(sellerApprovalAudits).values({ id: crypto.randomUUID(), sellerId: seller.id, adminId: result.actor.id, action: decision, previousStatus: seller.sellerApprovalStatus, nextStatus: decision, createdAt: now });
    return Response.json({ seller: { id: seller.id, status: decision } });
  } catch (error) { return routeError(error); }
}
