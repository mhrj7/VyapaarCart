CREATE TABLE IF NOT EXISTS "refresh_token_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "family_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" text NOT NULL,
  "revoked_at" text,
  "revocation_reason" text,
  "replaced_by_id" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_refresh_token_sessions_token_hash" ON "refresh_token_sessions" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_refresh_token_sessions_family_id" ON "refresh_token_sessions" USING btree ("family_id");
CREATE INDEX IF NOT EXISTS "idx_refresh_token_sessions_user_id" ON "refresh_token_sessions" USING btree ("user_id");
