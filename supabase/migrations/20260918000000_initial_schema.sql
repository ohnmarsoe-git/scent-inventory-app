-- Scent Syntax — initial schema
-- Costing method: WEIGHTED_AVERAGE (see lib/domain/costing/COSTING.md)
-- Primary currency: MMK

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('admin', 'staff');

CREATE TYPE product_type AS ENUM ('EDP', 'EDT', 'OTHER');

CREATE TYPE po_status AS ENUM (
  'draft',
  'ordered',
  'partially_received',
  'received',
  'cancelled'
);

CREATE TYPE inventory_item_type AS ENUM (
  'PERFUME_LIQUID',
  'DECANT',
  'CONSUMABLE'
);

CREATE TYPE inventory_unit AS ENUM ('ml', 'each');

CREATE TYPE movement_type AS ENUM (
  'PURCHASE_RECEIPT',
  'DECANT_OUT',
  'DECANT_IN',
  'SALE',
  'SALE_RETURN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'SAMPLE',
  'OTHER'
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'partial',
  'paid',
  'overpaid'
);

CREATE TYPE payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'mobile_wallet',
  'card',
  'other'
);

CREATE TYPE sale_item_product_type AS ENUM (
  'PERFUME_LIQUID',
  'DECANT',
  'CONSUMABLE',
  'OTHER'
);

CREATE TYPE costing_method AS ENUM ('WEIGHTED_AVERAGE');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Auth profiles
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  role user_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'admin'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

CREATE TABLE app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  costing_method costing_method NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
  base_currency text NOT NULL DEFAULT 'MMK',
  allow_negative_stock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO app_settings (id) VALUES (1);

CREATE TABLE doc_counters (
  doc_type text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  prefix text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO doc_counters (doc_type, prefix) VALUES
  ('purchase_order', 'PO'),
  ('sale', 'SO'),
  ('payment', 'PAY'),
  ('receipt', 'RCV'),
  ('decant', 'DEC'),
  ('expense', 'EXP');

CREATE OR REPLACE FUNCTION next_doc_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_next bigint;
BEGIN
  UPDATE doc_counters
  SET last_value = last_value + 1,
      updated_at = now()
  WHERE doc_type = p_doc_type
  RETURNING prefix, last_value INTO v_prefix, v_next;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Unknown doc_type: %', p_doc_type;
  END IF;

  RETURN v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 5, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- Masters
-- ---------------------------------------------------------------------------

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brands_name_unique UNIQUE (name)
);

CREATE TRIGGER brands_set_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  contact text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_unique UNIQUE (name)
);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  messenger_contact text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customers_name_idx ON customers (name);
CREATE INDEX customers_phone_idx ON customers (phone);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Perfume catalog (NOT a purchase lot). Cost derives from receipts / WAC.
CREATE TABLE perfumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands (id),
  name text NOT NULL,
  product_type product_type NOT NULL DEFAULT 'EDP',
  default_bottle_size_ml numeric(12, 2) NOT NULL CHECK (default_bottle_size_ml > 0),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perfumes_brand_name_unique UNIQUE (brand_id, name)
);

CREATE INDEX perfumes_brand_id_idx ON perfumes (brand_id);
CREATE INDEX perfumes_name_idx ON perfumes (name);

CREATE TRIGGER perfumes_set_updated_at
  BEFORE UPDATE ON perfumes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit inventory_unit NOT NULL DEFAULT 'each',
  purchase_price_mmk numeric(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_price_mmk >= 0),
  quantity_purchased numeric(14, 4) NOT NULL DEFAULT 0 CHECK (quantity_purchased >= 0),
  cost_per_unit_mmk numeric(14, 4) NOT NULL DEFAULT 0 CHECK (cost_per_unit_mmk >= 0),
  supplier_id uuid REFERENCES suppliers (id),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consumables_name_unique UNIQUE (name)
);

CREATE TRIGGER consumables_set_updated_at
  BEFORE UPDATE ON consumables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_name_unique UNIQUE (name)
);

INSERT INTO expense_categories (name) VALUES
  ('Delivery'),
  ('Shipping'),
  ('Advertising'),
  ('Tools'),
  ('Equipment'),
  ('Packaging'),
  ('Office'),
  ('Platform Fee'),
  ('Other');

CREATE TRIGGER expense_categories_set_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Purchasing
-- ---------------------------------------------------------------------------

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers (id),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_arrival_date date,
  currency text NOT NULL DEFAULT 'MMK',
  exchange_rate numeric(18, 8) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  shipping_cost_original numeric(14, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost_original >= 0),
  shipping_cost_mmk numeric(14, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost_mmk >= 0),
  other_cost_original numeric(14, 2) NOT NULL DEFAULT 0 CHECK (other_cost_original >= 0),
  other_cost_mmk numeric(14, 2) NOT NULL DEFAULT 0 CHECK (other_cost_mmk >= 0),
  subtotal_original numeric(14, 2) NOT NULL DEFAULT 0,
  subtotal_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  total_original numeric(14, 2) NOT NULL DEFAULT 0,
  total_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  status po_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE INDEX purchase_orders_status_idx ON purchase_orders (status);
CREATE INDEX purchase_orders_order_date_idx ON purchase_orders (order_date);

CREATE TRIGGER purchase_orders_set_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  perfume_id uuid NOT NULL REFERENCES perfumes (id),
  bottle_size_ml numeric(12, 2) NOT NULL CHECK (bottle_size_ml > 0),
  quantity numeric(12, 2) NOT NULL CHECK (quantity > 0),
  unit_cost_original numeric(14, 4) NOT NULL CHECK (unit_cost_original >= 0),
  unit_cost_mmk numeric(14, 4) NOT NULL CHECK (unit_cost_mmk >= 0),
  line_total_original numeric(14, 2) NOT NULL CHECK (line_total_original >= 0),
  line_total_mmk numeric(14, 2) NOT NULL CHECK (line_total_mmk >= 0),
  received_quantity numeric(12, 2) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT poi_received_lte_ordered CHECK (received_quantity <= quantity)
);

CREATE INDEX purchase_order_items_po_id_idx ON purchase_order_items (purchase_order_id);
CREATE INDEX purchase_order_items_perfume_id_idx ON purchase_order_items (perfume_id);

CREATE TRIGGER purchase_order_items_set_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id),
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_receipts_po_id_idx ON purchase_receipts (purchase_order_id);

CREATE TRIGGER purchase_receipts_set_updated_at
  BEFORE UPDATE ON purchase_receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE purchase_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_receipt_id uuid NOT NULL REFERENCES purchase_receipts (id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL REFERENCES purchase_order_items (id),
  perfume_id uuid NOT NULL REFERENCES perfumes (id),
  quantity_bottles numeric(12, 2) NOT NULL CHECK (quantity_bottles > 0),
  bottle_size_ml numeric(12, 2) NOT NULL CHECK (bottle_size_ml > 0),
  quantity_ml numeric(14, 4) NOT NULL CHECK (quantity_ml > 0),
  unit_cost_mmk_per_ml numeric(14, 6) NOT NULL CHECK (unit_cost_mmk_per_ml >= 0),
  line_cost_mmk numeric(14, 2) NOT NULL CHECK (line_cost_mmk >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_receipt_items_receipt_id_idx ON purchase_receipt_items (purchase_receipt_id);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------

CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type inventory_item_type NOT NULL,
  perfume_id uuid REFERENCES perfumes (id),
  consumable_id uuid REFERENCES consumables (id),
  size_ml numeric(12, 2),
  unit inventory_unit NOT NULL,
  quantity_on_hand numeric(14, 4) NOT NULL DEFAULT 0,
  avg_unit_cost_mmk numeric(14, 6) NOT NULL DEFAULT 0 CHECK (avg_unit_cost_mmk >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_qty_non_negative CHECK (quantity_on_hand >= 0),
  CONSTRAINT inventory_items_perfume_liquid_chk CHECK (
    item_type <> 'PERFUME_LIQUID'
    OR (perfume_id IS NOT NULL AND size_ml IS NULL AND unit = 'ml' AND consumable_id IS NULL)
  ),
  CONSTRAINT inventory_items_decant_chk CHECK (
    item_type <> 'DECANT'
    OR (perfume_id IS NOT NULL AND size_ml IS NOT NULL AND size_ml > 0 AND unit = 'each' AND consumable_id IS NULL)
  ),
  CONSTRAINT inventory_items_consumable_chk CHECK (
    item_type <> 'CONSUMABLE'
    OR (consumable_id IS NOT NULL AND perfume_id IS NULL AND size_ml IS NULL)
  )
);

CREATE UNIQUE INDEX inventory_items_perfume_liquid_uidx
  ON inventory_items (perfume_id)
  WHERE item_type = 'PERFUME_LIQUID';

CREATE UNIQUE INDEX inventory_items_decant_uidx
  ON inventory_items (perfume_id, size_ml)
  WHERE item_type = 'DECANT';

CREATE UNIQUE INDEX inventory_items_consumable_uidx
  ON inventory_items (consumable_id)
  WHERE item_type = 'CONSUMABLE';

CREATE TRIGGER inventory_items_set_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items (id),
  moved_at timestamptz NOT NULL DEFAULT now(),
  movement_type movement_type NOT NULL,
  quantity numeric(14, 4) NOT NULL,
  unit inventory_unit NOT NULL,
  unit_cost_mmk numeric(14, 6) NOT NULL DEFAULT 0,
  total_cost_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  purchase_receipt_id uuid REFERENCES purchase_receipts (id),
  purchase_receipt_item_id uuid REFERENCES purchase_receipt_items (id),
  decant_transaction_id uuid,
  sale_id uuid,
  sale_item_id uuid,
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_item_id_idx ON inventory_movements (inventory_item_id);
CREATE INDEX inventory_movements_moved_at_idx ON inventory_movements (moved_at);
CREATE INDEX inventory_movements_type_idx ON inventory_movements (movement_type);
CREATE INDEX inventory_movements_sale_id_idx ON inventory_movements (sale_id);

-- ---------------------------------------------------------------------------
-- Decanting
-- ---------------------------------------------------------------------------

CREATE TABLE decant_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decant_number text NOT NULL UNIQUE,
  perfume_id uuid NOT NULL REFERENCES perfumes (id),
  source_inventory_item_id uuid NOT NULL REFERENCES inventory_items (id),
  liquid_ml_used numeric(14, 4) NOT NULL CHECK (liquid_ml_used > 0),
  liquid_unit_cost_mmk numeric(14, 6) NOT NULL,
  liquid_total_cost_mmk numeric(14, 2) NOT NULL,
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER decant_transactions_set_updated_at
  BEFORE UPDATE ON decant_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE decant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decant_transaction_id uuid NOT NULL REFERENCES decant_transactions (id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items (id),
  size_ml numeric(12, 2) NOT NULL CHECK (size_ml > 0),
  quantity numeric(12, 2) NOT NULL CHECK (quantity > 0),
  perfume_cost_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  packaging_cost_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  unit_cogs_mmk numeric(14, 4) NOT NULL DEFAULT 0,
  total_cogs_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE decant_consumable_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decant_transaction_id uuid NOT NULL REFERENCES decant_transactions (id) ON DELETE CASCADE,
  decant_item_id uuid REFERENCES decant_items (id) ON DELETE CASCADE,
  consumable_id uuid NOT NULL REFERENCES consumables (id),
  inventory_item_id uuid NOT NULL REFERENCES inventory_items (id),
  quantity numeric(12, 4) NOT NULL CHECK (quantity > 0),
  unit_cost_mmk numeric(14, 4) NOT NULL DEFAULT 0,
  total_cost_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_decant_fk
  FOREIGN KEY (decant_transaction_id) REFERENCES decant_transactions (id);

-- ---------------------------------------------------------------------------
-- Sales & payments
-- ---------------------------------------------------------------------------

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid REFERENCES customers (id),
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  discount_mmk numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_mmk >= 0),
  subtotal_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  total_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  paid_amount_mmk numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount_mmk >= 0),
  remaining_amount_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  cogs_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  gross_profit_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  is_voided boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sales_sale_date_idx ON sales (sale_date);
CREATE INDEX sales_customer_id_idx ON sales (customer_id);
CREATE INDEX sales_payment_status_idx ON sales (payment_status);

CREATE TRIGGER sales_set_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items (id),
  product_type sale_item_product_type NOT NULL,
  perfume_id uuid REFERENCES perfumes (id),
  description text NOT NULL,
  size_ml numeric(12, 2),
  quantity numeric(12, 4) NOT NULL CHECK (quantity > 0),
  unit_sale_price_mmk numeric(14, 2) NOT NULL CHECK (unit_sale_price_mmk >= 0),
  line_discount_mmk numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_discount_mmk >= 0),
  line_total_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  unit_cogs_mmk numeric(14, 4) NOT NULL DEFAULT 0,
  cogs_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  profit_mmk numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sale_items_sale_id_idx ON sale_items (sale_id);

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_sale_fk
  FOREIGN KEY (sale_id) REFERENCES sales (id);

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_sale_item_fk
  FOREIGN KEY (sale_item_id) REFERENCES sale_items (id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL UNIQUE,
  sale_id uuid NOT NULL REFERENCES sales (id),
  customer_id uuid REFERENCES customers (id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_mmk numeric(14, 2) NOT NULL CHECK (amount_mmk > 0),
  payment_method payment_method NOT NULL DEFAULT 'cash',
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_sale_id_idx ON payments (sale_id);
CREATE INDEX payments_payment_date_idx ON payments (payment_date);

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL UNIQUE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid NOT NULL REFERENCES expense_categories (id),
  description text NOT NULL,
  amount_mmk numeric(14, 2) NOT NULL CHECK (amount_mmk > 0),
  payment_method payment_method NOT NULL DEFAULT 'cash',
  related_purchase_order_id uuid REFERENCES purchase_orders (id),
  notes text,
  created_by uuid REFERENCES profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_expense_date_idx ON expenses (expense_date);
CREATE INDEX expenses_category_id_idx ON expenses (category_id);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory helpers + receive RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_or_create_perfume_liquid_item(p_perfume_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM inventory_items
  WHERE item_type = 'PERFUME_LIQUID' AND perfume_id = p_perfume_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO inventory_items (item_type, perfume_id, unit, quantity_on_hand, avg_unit_cost_mmk)
  VALUES ('PERFUME_LIQUID', p_perfume_id, 'ml', 0, 0)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Apply WAC inbound movement and update on-hand qty.
CREATE OR REPLACE FUNCTION apply_inbound_wac(
  p_inventory_item_id uuid,
  p_qty numeric,
  p_unit_cost_mmk numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item inventory_items%ROWTYPE;
  v_new_avg numeric;
BEGIN
  SELECT * INTO v_item FROM inventory_items WHERE id = p_inventory_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_inventory_item_id;
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Inbound quantity must be positive';
  END IF;

  IF v_item.quantity_on_hand + p_qty = 0 THEN
    v_new_avg := 0;
  ELSE
    v_new_avg := (
      (v_item.quantity_on_hand * v_item.avg_unit_cost_mmk) + (p_qty * p_unit_cost_mmk)
    ) / (v_item.quantity_on_hand + p_qty);
  END IF;

  UPDATE inventory_items
  SET quantity_on_hand = quantity_on_hand + p_qty,
      avg_unit_cost_mmk = v_new_avg,
      updated_at = now()
  WHERE id = p_inventory_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION apply_outbound_qty(
  p_inventory_item_id uuid,
  p_qty numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_item inventory_items%ROWTYPE;
  v_allow_neg boolean;
BEGIN
  SELECT allow_negative_stock INTO v_allow_neg FROM app_settings WHERE id = 1;
  SELECT * INTO v_item FROM inventory_items WHERE id = p_inventory_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_inventory_item_id;
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Outbound quantity must be positive';
  END IF;

  IF NOT v_allow_neg AND v_item.quantity_on_hand < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock for item % (have %, need %)',
      p_inventory_item_id, v_item.quantity_on_hand, p_qty;
  END IF;

  UPDATE inventory_items
  SET quantity_on_hand = quantity_on_hand - p_qty,
      updated_at = now()
  WHERE id = p_inventory_item_id;

  RETURN v_item.avg_unit_cost_mmk;
END;
$$;

-- Receive stock against a purchase order (partial or full).
-- p_lines: json array of { purchase_order_item_id, quantity_bottles }
CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_purchase_order_id uuid,
  p_lines jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_po purchase_orders%ROWTYPE;
  v_receipt_id uuid;
  v_receipt_number text;
  v_line jsonb;
  v_poi purchase_order_items%ROWTYPE;
  v_qty_bottles numeric;
  v_qty_ml numeric;
  v_remaining numeric;
  v_alloc_factor numeric;
  v_line_cost_mmk numeric;
  v_unit_cost_per_ml numeric;
  v_item_id uuid;
  v_any_partial boolean := false;
  v_all_received boolean := true;
  v_goods_mmk numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF v_po.status IN ('cancelled', 'received') THEN
    RAISE EXCEPTION 'Cannot receive PO in status %', v_po.status;
  END IF;

  IF v_po.status = 'draft' THEN
    RAISE EXCEPTION 'PO must be ordered before receiving';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'No receipt lines provided';
  END IF;

  v_receipt_number := next_doc_number('receipt');

  INSERT INTO purchase_receipts (receipt_number, purchase_order_id, notes, created_by)
  VALUES (v_receipt_number, p_purchase_order_id, p_notes, v_uid)
  RETURNING id INTO v_receipt_id;

  SELECT COALESCE(SUM(line_total_mmk), 0) INTO v_goods_mmk
  FROM purchase_order_items
  WHERE purchase_order_id = p_purchase_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_poi
    FROM purchase_order_items
    WHERE id = (v_line->>'purchase_order_item_id')::uuid
      AND purchase_order_id = p_purchase_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO line not found on this order';
    END IF;

    v_qty_bottles := (v_line->>'quantity_bottles')::numeric;
    IF v_qty_bottles IS NULL OR v_qty_bottles <= 0 THEN
      RAISE EXCEPTION 'quantity_bottles must be positive';
    END IF;

    v_remaining := v_poi.quantity - v_poi.received_quantity;
    IF v_qty_bottles > v_remaining THEN
      RAISE EXCEPTION 'Cannot receive more than remaining for PO line % (remaining %)',
        v_poi.id, v_remaining;
    END IF;

    v_qty_ml := v_qty_bottles * v_poi.bottle_size_ml;

    -- Allocate proportional share of shipping/other across goods value
    IF v_goods_mmk > 0 THEN
      v_alloc_factor := v_poi.line_total_mmk / v_goods_mmk;
    ELSE
      v_alloc_factor := 0;
    END IF;

    v_line_cost_mmk :=
      (v_poi.unit_cost_mmk * v_qty_bottles)
      + ((v_po.shipping_cost_mmk + v_po.other_cost_mmk) * v_alloc_factor * (v_qty_bottles / v_poi.quantity));

    v_unit_cost_per_ml := CASE WHEN v_qty_ml = 0 THEN 0 ELSE v_line_cost_mmk / v_qty_ml END;

    INSERT INTO purchase_receipt_items (
      purchase_receipt_id,
      purchase_order_item_id,
      perfume_id,
      quantity_bottles,
      bottle_size_ml,
      quantity_ml,
      unit_cost_mmk_per_ml,
      line_cost_mmk
    ) VALUES (
      v_receipt_id,
      v_poi.id,
      v_poi.perfume_id,
      v_qty_bottles,
      v_poi.bottle_size_ml,
      v_qty_ml,
      v_unit_cost_per_ml,
      round(v_line_cost_mmk, 2)
    );

    UPDATE purchase_order_items
    SET received_quantity = received_quantity + v_qty_bottles
    WHERE id = v_poi.id;

    v_item_id := get_or_create_perfume_liquid_item(v_poi.perfume_id);
    PERFORM apply_inbound_wac(v_item_id, v_qty_ml, v_unit_cost_per_ml);

    INSERT INTO inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      unit,
      unit_cost_mmk,
      total_cost_mmk,
      purchase_receipt_id,
      notes,
      created_by
    ) VALUES (
      v_item_id,
      'PURCHASE_RECEIPT',
      v_qty_ml,
      'ml',
      v_unit_cost_per_ml,
      round(v_line_cost_mmk, 2),
      v_receipt_id,
      'Receive ' || v_qty_bottles || ' × ' || v_poi.bottle_size_ml || 'ml',
      v_uid
    );
  END LOOP;

  -- Refresh PO status
  SELECT
    bool_or(received_quantity < quantity),
    bool_and(received_quantity >= quantity)
  INTO v_any_partial, v_all_received
  FROM purchase_order_items
  WHERE purchase_order_id = p_purchase_order_id;

  UPDATE purchase_orders
  SET status = CASE
    WHEN v_all_received THEN 'received'::po_status
    WHEN EXISTS (
      SELECT 1 FROM purchase_order_items
      WHERE purchase_order_id = p_purchase_order_id AND received_quantity > 0
    ) THEN 'partially_received'::po_status
    ELSE status
  END
  WHERE id = p_purchase_order_id;

  RETURN v_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION receive_purchase_order(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION receive_purchase_order(uuid, jsonb, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE decant_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decant_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE decant_consumable_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- MVP: any authenticated user can read/write business data (single shop).
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY authenticated_all_app_settings ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_select_doc_counters ON doc_counters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_all_brands ON brands
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_suppliers ON suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_customers ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_perfumes ON perfumes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_consumables ON consumables
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_expense_categories ON expense_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_purchase_orders ON purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_purchase_order_items ON purchase_order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_purchase_receipts ON purchase_receipts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_purchase_receipt_items ON purchase_receipt_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_inventory_items ON inventory_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_inventory_movements ON inventory_movements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_decant_transactions ON decant_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_decant_items ON decant_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_decant_consumable_usages ON decant_consumable_usages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_sales ON sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_sale_items ON sale_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_payments ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all_expenses ON expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
