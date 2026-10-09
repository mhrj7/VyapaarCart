CREATE TABLE IF NOT EXISTS inventory_audits (
  id text PRIMARY KEY,
  store_id text NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  warehouse_id text NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  variant_id text NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  actor_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role text NOT NULL,
  sku text NOT NULL,
  previous_quantity integer NOT NULL CHECK (previous_quantity BETWEEN 0 AND 1000000),
  quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 1000000),
  stock_version integer NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 240),
  created_at text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);
CREATE INDEX IF NOT EXISTS idx_inventory_audits_warehouse_created ON inventory_audits(warehouse_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_audits_stock_version ON inventory_audits(warehouse_id, variant_id, stock_version);
