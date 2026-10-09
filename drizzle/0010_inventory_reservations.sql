CREATE TABLE IF NOT EXISTS inventory_reservations (
  id text PRIMARY KEY,
  buyer_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  variant_id text NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  unit_price integer NOT NULL CHECK (unit_price > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  UNIQUE (buyer_id, idempotency_key),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_reservations_variant_expiry ON inventory_reservations(variant_id, expires_at);
CREATE TABLE IF NOT EXISTS inventory_reservation_allocations (
  reservation_id text NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  warehouse_id text NOT NULL,
  variant_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY(reservation_id, warehouse_id),
  FOREIGN KEY(warehouse_id, variant_id) REFERENCES warehouse_stock(warehouse_id, variant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_reservation_allocations_stock ON inventory_reservation_allocations(variant_id, warehouse_id);

-- VOLATILE PL/pgSQL statements obtain fresh READ COMMITTED snapshots after
-- waiting for a lock. A single locking CTE with an older snapshot is unsafe here.
-- All reservation creation and stock writes serialize on the same SKU row.
CREATE OR REPLACE FUNCTION reserve_inventory(p_id text, p_buyer integer, p_variant text, p_quantity integer, p_key text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  existing inventory_reservations%ROWTYPE;
  item record;
  location record;
  remaining integer;
  take integer;
  available integer;
  instant timestamptz;
BEGIN
  IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 OR p_key IS NULL OR length(p_key) NOT BETWEEN 16 AND 80 THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;
  -- Serializes retries even when a reused key names another SKU.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer::text || ':' || p_key, 0));
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_buyer AND role IN ('buyer', 'seller')) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  SELECT * INTO existing FROM inventory_reservations WHERE buyer_id = p_buyer AND idempotency_key = p_key;
  IF FOUND THEN
    IF existing.variant_id <> p_variant OR existing.quantity <> p_quantity THEN
      RETURN jsonb_build_object('error', 'key_conflict');
    END IF;
    RETURN jsonb_build_object('id', existing.id);
  END IF;
  PERFORM 1 FROM product_variants WHERE id = p_variant FOR UPDATE;
  SELECT v.price, s.owner_id INTO item FROM product_variants v
    JOIN products p ON p.id = v.product_id JOIN stores s ON s.id = p.store_id
    JOIN users u ON u.id = s.owner_id
    WHERE v.id = p_variant AND v.status = 'active' AND p.status = 'active'
      AND s.is_public AND (u.seller_approval_status = 'approved' OR u.role = 'admin') AND v.price > 0;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF item.owner_id = p_buyer THEN RETURN jsonb_build_object('error', 'own_store'); END IF;
  instant := clock_timestamp();
  SELECT * INTO existing FROM inventory_reservations WHERE buyer_id = p_buyer AND variant_id = p_variant AND expires_at > instant LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('error', 'already_held', 'id', existing.id); END IF;
  SELECT coalesce(sum(greatest(0, stock.quantity - coalesce((
    SELECT sum(a.quantity) FROM inventory_reservation_allocations a JOIN inventory_reservations r ON r.id = a.reservation_id
    WHERE a.variant_id = stock.variant_id AND a.warehouse_id = stock.warehouse_id AND r.expires_at > instant
  ), 0))), 0)::integer INTO available FROM warehouse_stock stock WHERE stock.variant_id = p_variant;
  IF available < p_quantity THEN RETURN jsonb_build_object('error', 'insufficient', 'available', available); END IF;
  INSERT INTO inventory_reservations(id, buyer_id, variant_id, quantity, unit_price, idempotency_key, created_at, expires_at)
    VALUES(p_id, p_buyer, p_variant, p_quantity, item.price, p_key, instant, instant + interval '10 minutes');
  remaining := p_quantity;
  FOR location IN SELECT stock.warehouse_id, greatest(0, stock.quantity - coalesce((
      SELECT sum(a.quantity) FROM inventory_reservation_allocations a JOIN inventory_reservations r ON r.id = a.reservation_id
      WHERE a.variant_id = stock.variant_id AND a.warehouse_id = stock.warehouse_id AND r.expires_at > instant
    ), 0))::integer AS free FROM warehouse_stock stock WHERE stock.variant_id = p_variant ORDER BY stock.warehouse_id LOOP
    take := least(remaining, location.free);
    IF take > 0 THEN
      INSERT INTO inventory_reservation_allocations VALUES(p_id, location.warehouse_id, p_variant, take);
      remaining := remaining - take;
    END IF;
    EXIT WHEN remaining = 0;
  END LOOP;
  IF remaining <> 0 THEN RAISE EXCEPTION 'Reservation allocation invariant failed'; END IF;
  RETURN jsonb_build_object('id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION protect_reserved_inventory() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
DECLARE held integer;
BEGIN
  PERFORM 1 FROM product_variants WHERE id = NEW.variant_id FOR UPDATE;
  SELECT coalesce(sum(a.quantity), 0)::integer INTO held FROM inventory_reservation_allocations a
    JOIN inventory_reservations r ON r.id = a.reservation_id
    WHERE a.variant_id = NEW.variant_id AND a.warehouse_id = NEW.warehouse_id AND r.expires_at > clock_timestamp();
  IF NEW.quantity < held THEN
    RAISE EXCEPTION 'Stock cannot be lower than active reservations' USING ERRCODE = 'P0022';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_reserved_inventory ON warehouse_stock;
-- New stock rows have no allocations; existing-row updates need the guard.
-- Avoid acquiring SKU-before-stock locks in INSERT ... ON CONFLICT retries.
CREATE TRIGGER protect_reserved_inventory BEFORE UPDATE OF quantity ON warehouse_stock
FOR EACH ROW EXECUTE FUNCTION protect_reserved_inventory();
