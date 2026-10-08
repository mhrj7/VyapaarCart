CREATE TABLE IF NOT EXISTS "stores" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text NOT NULL,
  "city" text NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_stores_slug" ON "stores" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stores_owner_id" ON "stores" USING btree ("owner_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_products" (
  "id" text PRIMARY KEY NOT NULL,
  "store_id" text NOT NULL REFERENCES "public"."stores"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "price" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_store_products_store_status" ON "store_products" USING btree ("store_id","status");
