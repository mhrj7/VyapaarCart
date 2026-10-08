import { getDb } from "../../../../db";
import { refreshTokenSessions } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { hashRefreshToken, issueAccessToken, newRefreshToken, refreshTokenExpiry } from "../../../../lib/api-tokens";
import { ensureUser } from "../../../../lib/marketplace";

export async function POST(request: Request) {
  const identity = await requireUser(request);
  if (!identity) return Response.json({ error: "Sign in before creating an API session." }, { status: 401 });

  try {
    const db = getDb();
    const user = await ensureUser(db, identity.clerkId);
    const refreshToken = newRefreshToken();
    const now = new Date();
    const familyId = crypto.randomUUID();
    await db.insert(refreshTokenSessions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      familyId,
      tokenHash: await hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(now),
      createdAt: now.toISOString(),
    });
    return Response.json({
      accessToken: await issueAccessToken(identity),
      refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresAt: refreshTokenExpiry(now),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create API session.";
    return Response.json({ error: message }, { status: message.includes("JWT authentication") ? 503 : 500 });
  }
}
