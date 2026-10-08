export type RefreshTokenRecord = {
  expiresAt: string;
  revokedAt: string | null;
};

export function refreshTokenState(record: RefreshTokenRecord, now = new Date()) {
  if (record.revokedAt) return "reused_or_revoked" as const;
  if (new Date(record.expiresAt).getTime() <= now.getTime()) return "expired" as const;
  return "active" as const;
}

export function canRotateRefreshToken(record: RefreshTokenRecord, now = new Date()) {
  return refreshTokenState(record, now) === "active";
}
