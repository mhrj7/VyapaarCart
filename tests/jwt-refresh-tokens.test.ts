import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_AUTH_SECRET = "test-only-jwt-secret-that-is-long-enough-for-hs256";

const { hashRefreshToken, issueAccessToken, newRefreshToken, refreshTokenExpiry, verifyAccessToken } = await import("../lib/api-tokens");
const { canRotateRefreshToken, refreshTokenState } = await import("../lib/refresh-token-policy");

test("access JWT is signed and verifies only for its subject", async () => {
  const token = await issueAccessToken({ clerkId: "user_123" });
  assert.deepEqual(await verifyAccessToken(token), { clerkId: "user_123" });
  assert.equal(await verifyAccessToken(`${token}tampered`), null);
});

test("refresh token rotation makes the presented token single-use", async () => {
  const rawToken = newRefreshToken();
  const hash = await hashRefreshToken(rawToken);
  assert.equal(hash, await hashRefreshToken(rawToken));
  assert.equal(canRotateRefreshToken({ expiresAt: refreshTokenExpiry(), revokedAt: null }), true);

  const rotated = { expiresAt: refreshTokenExpiry(), revokedAt: new Date().toISOString() };
  assert.equal(canRotateRefreshToken(rotated), false);
  assert.equal(refreshTokenState(rotated), "reused_or_revoked");
});

test("revoked and expired refresh tokens are invalidated", () => {
  assert.equal(refreshTokenState({ expiresAt: refreshTokenExpiry(), revokedAt: new Date().toISOString() }), "reused_or_revoked");
  assert.equal(refreshTokenState({ expiresAt: "2020-01-01T00:00:00.000Z", revokedAt: null }), "expired");
});
