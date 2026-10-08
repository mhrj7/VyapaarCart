CREATE TABLE IF NOT EXISTS "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_slug" ON "categories" USING btree ("slug");

INSERT INTO "categories" ("id", "name", "slug") VALUES
  ('cat_electronics', 'Electronics', 'electronics'),
  ('cat_home', 'Home and furniture', 'home-furniture'),
  ('cat_fashion', 'Fashion', 'fashion'),
  ('cat_books', 'Books', 'books'),
  ('cat_vehicles', 'Vehicles', 'vehicles'),
  ('cat_sports', 'Sports', 'sports'),
  ('cat_other', 'Other', 'other')
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY NOT NULL,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "category_id" text NOT NULL REFERENCES "categories"("id") ON DELETE restrict,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "price" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_products_store_status" ON "products" USING btree ("store_id", "status");
CREATE INDEX IF NOT EXISTS "idx_products_category_status" ON "products" USING btree ("category_id", "status");
CREATE INDEX IF NOT EXISTS "idx_products_title" ON "products" USING btree ("title");

CREATE TABLE IF NOT EXISTS "product_attributes" (
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
  PRIMARY KEY ("product_id", "key")
);
CREATE INDEX IF NOT EXISTS "idx_product_attributes_key_value" ON "product_attributes" USING btree ("key", "value");

INSERT INTO "products" ("id", "store_id", "category_id", "title", "description", "price", "status", "created_at", "updated_at")
SELECT "id", "store_id", 'cat_other', "title", "description", "price", "status", "created_at", "updated_at"
FROM "store_products"
ON CONFLICT ("id") DO NOTHING;
