import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { organizationMembers, organizations, users } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import { actorFor, routeError } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to view organizations." }, { status: 401 });
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    const rows = actor.role === "admin"
      ? await db.select().from(organizations).orderBy(desc(organizations.createdAt))
      : await db.select({ organization: organizations }).from(organizationMembers).innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id)).where(eq(organizationMembers.userId, actor.id)).orderBy(desc(organizations.createdAt));
    return Response.json({ organizations: rows.map((row) => "organization" in row ? row.organization : row) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to create an organization." }, { status: 401 });
    const { name } = await request.json() as { name?: string };
    const displayName = name?.trim().slice(0, 80);
    if (!displayName) return Response.json({ error: "Organization name is required." }, { status: 400 });
    const db = getDb();
    const actor = await actorFor(db, identity.clerkId);
    // Creating a team workspace is the explicit seller-onboarding action.
    // A buyer becomes a seller at this point; administrators keep their role.
    if (actor.role === "buyer") await db.update(users).set({ role: "seller" }).where(eq(users.id, actor.id));
    if (actor.role !== "buyer" && actor.role !== "seller" && actor.role !== "admin") return Response.json({ error: "This account cannot create organizations." }, { status: 403 });
    const organization = { id: crypto.randomUUID(), name: displayName, slug: `${slugify(displayName)}-${crypto.randomUUID().slice(0, 6)}`, ownerId: actor.id, createdAt: new Date().toISOString() };
    await db.insert(organizations).values(organization);
    await db.insert(organizationMembers).values({ organizationId: organization.id, userId: actor.id, role: "owner", createdAt: organization.createdAt });
    return Response.json({ organization }, { status: 201 });
  } catch (error) { return routeError(error); }
}
