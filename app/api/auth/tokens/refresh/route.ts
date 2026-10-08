import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { refreshTokenSessions, users } from "../../../../../db/schema";
import { hashRefreshToken, issueAccessToken, newRefreshToken, refreshTokenExpiry } from "../../../../../lib/api-tokens";
import { canRotateRefreshToken } from "../../../../../lib/refresh-token-policy";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { refreshToken?: string } | null;
  if (!body?.refreshToken || body.refreshToken.length < 32) return Response.json({ error: "A refresh token is required." }, { status: 400 });

  try {
    const db = getDb();
    const tokenHash = await hashRefreshToken(body.refreshToken);
    const [session] = await db.select({ session: refreshTokenSessions, user: users })
      .from(refreshTokenSessions)
      .innerJoin(users, eq(refreshTokenSessions.userId, users.id))
      .where(eq(refreshTokenSessions.tokenHash, tokenHash))
      .limit(1);
    if (!session) return Response.json({ error: "Refresh token is invalid." }, { status: 401 });

    const now = new Date();
    if (!canRotateRefreshToken(session.session, now)) {
      // Seeing a revoked token is a reuse signal: invalidate its entire family.
      if (session.session.revokedAt) {
        await db.update(refreshTokenSessions).set({ revokedAt: now.toISOString(), revocationReason: "reuse_detected" })
          .where(and(eq(refreshTokenSessions.familyId, session.session.familyId), isNull(refreshTokenSessions.revokedAt)));
      }
      return Response.json({ error: "Refresh token is expired, revoked, or has already been used." }, { status: 401 });
    }

    const replacementId = crypto.randomUUID();
    const refreshToken = newRefreshToken();
    const expiresAt = refreshTokenExpiry(now);
    // The conditional write is the single-use guard if two refresh requests race.
    const rotated = await db.update(refreshTokenSessions).set({
      revokedAt: now.toISOString(),
      revocationReason: "rotated",
      replacedById: replacementId,
    }).where(and(eq(refreshTokenSessions.id, session.session.id), isNull(refreshTokenSessions.revokedAt))).returning();
    if (rotated.length !== 1) return Response.json({ error: "Refresh token has already been used." }, { status: 401 });

    await db.insert(refreshTokenSessions).values({
      id: replacementId,
      userId: session.user.id,
      familyId: session.session.familyId,
      tokenHash: await hashRefreshToken(refreshToken),
      expiresAt,
      createdAt: now.toISOString(),
    });
    return Response.json({
      accessToken: await issueAccessToken({ clerkId: session.user.clerkId }),
      refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresAt: expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not refresh API session.";
    return Response.json({ error: message }, { status: message.includes("JWT authentication") ? 503 : 500 });
  }
}
