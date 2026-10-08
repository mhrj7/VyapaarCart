import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { organizationMembers, organizations, users } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { canInviteOrganizationStaff } from "../../../../../lib/authorization";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function ownerActor(request: Request, organizationId: string) {
  const identity = await requireUser(request);
  if (!identity) return null;
  const db = getDb();
  const actor = await actorFor(db, identity.clerkId);
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization || !canInviteOrganizationStaff(actor, organization.ownerId)) return null;
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
    const { email, role } = await request.json() as { email?: string; role?: string };
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return Response.json({ error: "Enter a valid teammate email address." }, { status: 400 });
    const memberRole = role === "manager" ? "manager" : "member";
    const client = await clerkClient();
    const found = await client.users.getUserList({ emailAddress: [normalizedEmail], limit: 1 });
    const invitedUser = found.data[0];
    if (!invitedUser) return Response.json({ error: "This teammate needs to sign in to VyapaarCart once before you can invite them." }, { status: 404 });
    const member = await actorFor(result.db, invitedUser.id);
    if (member.id === result.organization.ownerId) return Response.json({ error: "The organization owner is already on this team." }, { status: 400 });
    if (member.role !== "admin") await result.db.update(users).set({ role: "seller_staff", staffForSellerId: result.organization.ownerId, sellerApprovalStatus: "approved" }).where(eq(users.id, member.id));
    await result.db.insert(organizationMembers).values({ organizationId: id, userId: member.id, role: memberRole, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: [organizationMembers.organizationId, organizationMembers.userId], set: { role: memberRole } });
    return Response.json({ member: { id: member.id, displayName: invitedUser.fullName || invitedUser.username || normalizedEmail, role: memberRole } }, { status: 201 });
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
