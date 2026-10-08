import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { refreshTokenSessions } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { hashRefreshToken } from "../../../../../lib/api-tokens";
import { ensureUser } from "../../../../../lib/marketplace";

export async function POST(request: Request) {
  const identity = await requireUser(request);
  if (!identity) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { refreshToken?: string } | null;
  if (!body?.refreshToken) return Response.json({ error: "A refresh token is required." }, { status: 400 });

  const db = getDb();
  const user = await ensureUser(db, identity.clerkId);
  const [session] = await db.select().from(refreshTokenSessions).where(and(eq(refreshTokenSessions.userId, user.id), eq(refreshTokenSessions.tokenHash, await hashRefreshToken(body.refreshToken)))).limit(1);
  if (!session) return Response.json({ error: "Refresh token is not active for this user." }, { status: 404 });

  const result = await db.update(refreshTokenSessions).set({ revokedAt: new Date().toISOString(), revocationReason: "user_revoked" })
    .where(and(eq(refreshTokenSessions.familyId, session.familyId), isNull(refreshTokenSessions.revokedAt))).returning();
  return Response.json({ revoked: result.length });
}
