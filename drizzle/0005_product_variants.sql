CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "sku" text NOT NULL,
  "price" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_variants_sku" ON "product_variants" USING btree ("sku");
CREATE INDEX IF NOT EXISTS "idx_product_variants_product_status" ON "product_variants" USING btree ("product_id", "status");

CREATE TABLE IF NOT EXISTS "product_variant_attributes" (
  "variant_id" text NOT NULL REFERENCES "product_variants"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  PRIMARY KEY ("variant_id", "key")
);
CREATE INDEX IF NOT EXISTS "idx_product_variant_attributes_key_value" ON "product_variant_attributes" USING btree ("key", "value");

INSERT INTO "product_variants" ("id", "product_id", "name", "sku", "price", "status", "created_at", "updated_at")
SELECT 'legacy-' || "id", "id", 'Standard', 'LEGACY-' || upper(replace("id", '-', '')), "price", "status", "created_at", "updated_at"
FROM "products"
ON CONFLICT ("id") DO NOTHING;
