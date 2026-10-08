import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sellerApprovalAudits, users } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError } from "../../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to view seller approval." }, { status: 401 });
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    const audits = await db.select().from(sellerApprovalAudits).where(eq(sellerApprovalAudits.sellerId, actor.id)).orderBy(desc(sellerApprovalAudits.createdAt));
    return Response.json({ status: actor.sellerApprovalStatus, audits });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to request seller approval." }, { status: 401 });
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    if (actor.role === "admin" || actor.sellerApprovalStatus === "approved") return Response.json({ status: "approved" });
    if (actor.sellerApprovalStatus === "pending") return Response.json({ status: "pending" });
    const now = new Date().toISOString();
    await db.update(users).set({ sellerApprovalStatus: "pending", sellerApprovalRequestedAt: now }).where(eq(users.id, actor.id));
    await db.insert(sellerApprovalAudits).values({ id: crypto.randomUUID(), sellerId: actor.id, action: "requested", previousStatus: actor.sellerApprovalStatus, nextStatus: "pending", createdAt: now });
    return Response.json({ status: "pending" }, { status: 202 });
  } catch (error) { return routeError(error); }
}
