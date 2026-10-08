import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();
const issuer = "vyapaarcart-api";
const audience = "vyapaarcart-client";
const accessTokenLifetime = "15m";
export const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function signingKey() {
  const secret = process.env.JWT_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT authentication is not configured.");
  return encoder.encode(secret);
}

export type ApiIdentity = { clerkId: string };

export async function issueAccessToken(identity: ApiIdentity) {
  return new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(identity.clerkId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(accessTokenLifetime)
    .sign(signingKey());
}

export async function verifyAccessToken(token: string): Promise<ApiIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), { issuer, audience });
    if (payload.type !== "access" || typeof payload.sub !== "string" || !payload.sub) return null;
    return { clerkId: payload.sub };
  } catch {
    return null;
  }
}

export function newRefreshToken() {
  const value = new Uint8Array(48);
  crypto.getRandomValues(value);
  return Buffer.from(value).toString("base64url");
}

export async function hashRefreshToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Buffer.from(digest).toString("hex");
}

export function refreshTokenExpiry(now = new Date()) {
  return new Date(now.getTime() + refreshTokenLifetimeMs).toISOString();
}
