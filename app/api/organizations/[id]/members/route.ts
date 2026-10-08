import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { organizationMembers, organizations, users } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function ownerActor(request: Request, organizationId: string) {
  const identity = await requireUser(request);
  if (!identity) return null;
  const db = getDb();
  const actor = await actorFor(db, identity.clerkId);
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization || (actor.role !== "admin" && organization.ownerId !== actor.id)) return null;
  return { db, actor, organization };
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerActor(request, id);
    if (!result) return Response.json({ error: "Organization not found." }, { status: 404 });
    const members = await result.db.select({ id: users.id, clerkId: users.clerkId, displayName: users.displayName, role: organizationMembers.role }).from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id)).where(eq(organizationMembers.organizationId, id));
    return Response.json({ organization: result.organization, members });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerActor(request, id);
    if (!result) return Response.json({ error: "Organization not found." }, { status: 404 });
    const { clerkId, role } = await request.json() as { clerkId?: string; role?: string };
    if (!clerkId?.trim()) return Response.json({ error: "Member Clerk user ID is required." }, { status: 400 });
    const memberRole = role === "manager" ? "manager" : "member";
    const member = await actorFor(result.db, clerkId.trim());
    await result.db.insert(organizationMembers).values({ organizationId: id, userId: member.id, role: memberRole, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: [organizationMembers.organizationId, organizationMembers.userId], set: { role: memberRole } });
    return Response.json({ member: { id: member.id, clerkId: member.clerkId, role: memberRole } }, { status: 201 });
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const result = await ownerActor(request, id);
    if (!result) return Response.json({ error: "Organization not found." }, { status: 404 });
    const { clerkId } = await request.json() as { clerkId?: string };
    const [member] = clerkId ? await result.db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1) : [];
    if (!member || member.id === result.organization.ownerId) return Response.json({ error: "Choose a non-owner member to remove." }, { status: 400 });
    await result.db.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, id), eq(organizationMembers.userId, member.id)));
    return Response.json({ ok: true });
  } catch (error) { return routeError(error); }
}
