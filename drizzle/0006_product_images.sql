CREATE TABLE IF NOT EXISTS "product_images" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE restrict,
  "object_key" text NOT NULL,
  "alt_text" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  "position" integer NOT NULL CHECK (position >= 0),
  "status" text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'active', 'deleting')),
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_images_object_key" ON "product_images" ("object_key");
CREATE INDEX IF NOT EXISTS "idx_product_images_order" ON "product_images" ("product_id", "status", "position");
