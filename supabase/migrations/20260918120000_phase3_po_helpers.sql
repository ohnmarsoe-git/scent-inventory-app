-- Phase 3 helpers: document numbers + atomic PO create/update for authenticated users

CREATE OR REPLACE FUNCTION next_doc_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION next_doc_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_doc_number(text) TO authenticated;

-- Create a draft purchase order with lines.
-- p_lines: [{ perfume_id, bottle_size_ml, quantity, unit_cost_original, notes? }]
CREATE OR REPLACE FUNCTION create_purchase_order(
  p_supplier_id uuid,
  p_order_date date,
  p_expected_arrival_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_shipping_cost_original numeric,
  p_other_cost_original numeric,
  p_notes text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_po_id uuid;
  v_po_number text;
  v_line jsonb;
  v_subtotal_original numeric := 0;
  v_subtotal_mmk numeric := 0;
  v_rate numeric;
  v_unit_original numeric;
  v_qty numeric;
  v_line_original numeric;
  v_line_mmk numeric;
  v_unit_mmk numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one line item';
  END IF;

  IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
    RAISE EXCEPTION 'Exchange rate must be positive';
  END IF;

  v_rate := p_exchange_rate;
  v_po_number := next_doc_number('purchase_order');

  INSERT INTO purchase_orders (
    po_number,
    supplier_id,
    order_date,
    expected_arrival_date,
    currency,
    exchange_rate,
    shipping_cost_original,
    shipping_cost_mmk,
    other_cost_original,
    other_cost_mmk,
    status,
    notes,
    created_by
  ) VALUES (
    v_po_number,
    p_supplier_id,
    COALESCE(p_order_date, CURRENT_DATE),
    p_expected_arrival_date,
    COALESCE(NULLIF(p_currency, ''), 'MMK'),
    v_rate,
    COALESCE(p_shipping_cost_original, 0),
    round(COALESCE(p_shipping_cost_original, 0) * v_rate, 2),
    COALESCE(p_other_cost_original, 0),
    round(COALESCE(p_other_cost_original, 0) * v_rate, 2),
    'draft',
    p_notes,
    v_uid
  )
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := (v_line->>'quantity')::numeric;
    v_unit_original := (v_line->>'unit_cost_original')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Line quantity must be positive';
    END IF;
    IF v_unit_original IS NULL OR v_unit_original < 0 THEN
      RAISE EXCEPTION 'Line unit cost cannot be negative';
    END IF;

    v_line_original := round(v_qty * v_unit_original, 2);
    v_unit_mmk := round(v_unit_original * v_rate, 4);
    v_line_mmk := round(v_line_original * v_rate, 2);

    INSERT INTO purchase_order_items (
      purchase_order_id,
      perfume_id,
      bottle_size_ml,
      quantity,
      unit_cost_original,
      unit_cost_mmk,
      line_total_original,
      line_total_mmk,
      notes
    ) VALUES (
      v_po_id,
      (v_line->>'perfume_id')::uuid,
      (v_line->>'bottle_size_ml')::numeric,
      v_qty,
      v_unit_original,
      v_unit_mmk,
      v_line_original,
      v_line_mmk,
      NULLIF(v_line->>'notes', '')
    );

    v_subtotal_original := v_subtotal_original + v_line_original;
    v_subtotal_mmk := v_subtotal_mmk + v_line_mmk;
  END LOOP;

  UPDATE purchase_orders
  SET
    subtotal_original = v_subtotal_original,
    subtotal_mmk = v_subtotal_mmk,
    total_original = v_subtotal_original + COALESCE(p_shipping_cost_original, 0) + COALESCE(p_other_cost_original, 0),
    total_mmk = v_subtotal_mmk
      + round(COALESCE(p_shipping_cost_original, 0) * v_rate, 2)
      + round(COALESCE(p_other_cost_original, 0) * v_rate, 2)
  WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;

REVOKE ALL ON FUNCTION create_purchase_order(uuid, date, date, text, numeric, numeric, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_purchase_order(uuid, date, date, text, numeric, numeric, numeric, text, jsonb) TO authenticated;

-- Replace draft PO lines (draft only).
CREATE OR REPLACE FUNCTION update_draft_purchase_order(
  p_purchase_order_id uuid,
  p_supplier_id uuid,
  p_order_date date,
  p_expected_arrival_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_shipping_cost_original numeric,
  p_other_cost_original numeric,
  p_notes text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_po purchase_orders%ROWTYPE;
  v_line jsonb;
  v_subtotal_original numeric := 0;
  v_subtotal_mmk numeric := 0;
  v_rate numeric;
  v_unit_original numeric;
  v_qty numeric;
  v_line_original numeric;
  v_line_mmk numeric;
  v_unit_mmk numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;
  IF v_po.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft purchase orders can be edited';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one line item';
  END IF;

  v_rate := p_exchange_rate;
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'Exchange rate must be positive';
  END IF;

  DELETE FROM purchase_order_items WHERE purchase_order_id = p_purchase_order_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_qty := (v_line->>'quantity')::numeric;
    v_unit_original := (v_line->>'unit_cost_original')::numeric;
    v_line_original := round(v_qty * v_unit_original, 2);
    v_unit_mmk := round(v_unit_original * v_rate, 4);
    v_line_mmk := round(v_line_original * v_rate, 2);

    INSERT INTO purchase_order_items (
      purchase_order_id,
      perfume_id,
      bottle_size_ml,
      quantity,
      unit_cost_original,
      unit_cost_mmk,
      line_total_original,
      line_total_mmk,
      notes
    ) VALUES (
      p_purchase_order_id,
      (v_line->>'perfume_id')::uuid,
      (v_line->>'bottle_size_ml')::numeric,
      v_qty,
      v_unit_original,
      v_unit_mmk,
      v_line_original,
      v_line_mmk,
      NULLIF(v_line->>'notes', '')
    );

    v_subtotal_original := v_subtotal_original + v_line_original;
    v_subtotal_mmk := v_subtotal_mmk + v_line_mmk;
  END LOOP;

  UPDATE purchase_orders
  SET
    supplier_id = p_supplier_id,
    order_date = COALESCE(p_order_date, order_date),
    expected_arrival_date = p_expected_arrival_date,
    currency = COALESCE(NULLIF(p_currency, ''), currency),
    exchange_rate = v_rate,
    shipping_cost_original = COALESCE(p_shipping_cost_original, 0),
    shipping_cost_mmk = round(COALESCE(p_shipping_cost_original, 0) * v_rate, 2),
    other_cost_original = COALESCE(p_other_cost_original, 0),
    other_cost_mmk = round(COALESCE(p_other_cost_original, 0) * v_rate, 2),
    subtotal_original = v_subtotal_original,
    subtotal_mmk = v_subtotal_mmk,
    total_original = v_subtotal_original + COALESCE(p_shipping_cost_original, 0) + COALESCE(p_other_cost_original, 0),
    total_mmk = v_subtotal_mmk
      + round(COALESCE(p_shipping_cost_original, 0) * v_rate, 2)
      + round(COALESCE(p_other_cost_original, 0) * v_rate, 2),
    notes = p_notes
  WHERE id = p_purchase_order_id;

  RETURN p_purchase_order_id;
END;
$$;

REVOKE ALL ON FUNCTION update_draft_purchase_order(uuid, uuid, date, date, text, numeric, numeric, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_draft_purchase_order(uuid, uuid, date, date, text, numeric, numeric, numeric, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION set_purchase_order_status(
  p_purchase_order_id uuid,
  p_status po_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_po purchase_orders%ROWTYPE;
  v_has_lines boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id = p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF p_status = 'ordered' THEN
    IF v_po.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft POs can be marked ordered';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM purchase_order_items WHERE purchase_order_id = p_purchase_order_id
    ) INTO v_has_lines;
    IF NOT v_has_lines THEN
      RAISE EXCEPTION 'Cannot order a PO with no lines';
    END IF;
  ELSIF p_status = 'cancelled' THEN
    IF v_po.status IN ('received', 'cancelled') THEN
      RAISE EXCEPTION 'Cannot cancel a % PO', v_po.status;
    END IF;
    IF v_po.status = 'partially_received' THEN
      RAISE EXCEPTION 'Cannot cancel a partially received PO';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported status transition to %', p_status;
  END IF;

  UPDATE purchase_orders SET status = p_status WHERE id = p_purchase_order_id;
  RETURN p_purchase_order_id;
END;
$$;

REVOKE ALL ON FUNCTION set_purchase_order_status(uuid, po_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_purchase_order_status(uuid, po_status) TO authenticated;
