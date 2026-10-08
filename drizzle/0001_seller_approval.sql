ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seller_approval_status" text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seller_approval_requested_at" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seller_approved_at" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seller_approved_by_id" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_approval_audits" (
  "id" text PRIMARY KEY NOT NULL,
  "seller_id" integer NOT NULL,
  "admin_id" integer,
  "action" text NOT NULL,
  "previous_status" text NOT NULL,
  "next_status" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  CONSTRAINT "seller_approval_audits_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "seller_approval_audits_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_seller_approval_audits_seller_created_at" ON "seller_approval_audits" USING btree ("seller_id","created_at");--> statement-breakpoint
UPDATE "users" SET "seller_approval_status" = 'approved' WHERE "role" IN ('seller', 'seller_staff') AND "seller_approval_status" = 'not_requested';
