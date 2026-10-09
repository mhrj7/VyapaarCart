CREATE TABLE IF NOT EXISTS warehouses (
 id text PRIMARY KEY, store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 name text NOT NULL, address text NOT NULL, city text NOT NULL, postcode text NOT NULL,
 created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text, updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);
CREATE INDEX IF NOT EXISTS idx_warehouses_store ON warehouses(store_id);
CREATE TABLE IF NOT EXISTS warehouse_stock (
 warehouse_id text NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
 variant_id text NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
 quantity integer NOT NULL DEFAULT 0 CONSTRAINT warehouse_stock_quantity_check CHECK (quantity >= 0 AND quantity <= 1000000),
 version integer NOT NULL DEFAULT 1, updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
 PRIMARY KEY (warehouse_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_variant ON warehouse_stock(variant_id);
