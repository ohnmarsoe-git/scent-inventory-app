-- Phase 5: Sales, payments, customer helpers

CREATE OR REPLACE FUNCTION refresh_sale_payment_status(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  UPDATE sales
  SET
    remaining_amount_mmk = greatest(total_mmk - paid_amount_mmk, 0),
    payment_status = CASE
      WHEN paid_amount_mmk <= 0 THEN 'unpaid'::payment_status
      WHEN paid_amount_mmk < total_mmk THEN 'partial'::payment_status
      WHEN paid_amount_mmk = total_mmk THEN 'paid'::payment_status
      ELSE 'overpaid'::payment_status
    END
  WHERE id = p_sale_id;
END;
$$;

-- Create a sale and deduct stock. Optional initial payment.
-- p_lines: [{ inventory_item_id, quantity, unit_sale_price_mmk, line_discount_mmk }]
-- p_initial_payment: { amount_mmk, payment_method, notes } or null
CREATE OR REPLACE FUNCTION create_sale(
  p_customer_id uuid,
  p_sale_date date,
  p_discount_mmk numeric,
  p_notes text,
  p_lines jsonb,
  p_initial_payment jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale_id uuid;
  v_sale_number text;
  v_line jsonb;
  v_item inventory_items%ROWTYPE;
  v_qty numeric;
  v_price numeric;
  v_line_discount numeric;
  v_line_total numeric;
  v_unit_cogs numeric;
  v_line_cogs numeric;
  v_line_profit numeric;
  v_subtotal numeric := 0;
  v_cogs numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_sale_item_id uuid;
  v_product_type sale_item_product_type;
  v_description text;
  v_perfume_name text;
  v_brand_name text;
  v_pay_amount numeric;
  v_pay_method payment_method;
  v_pay_notes text;
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one sale line';
  END IF;

  v_discount := COALESCE(p_discount_mmk, 0);
  IF v_discount < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  v_sale_number := next_doc_number('sale');

  INSERT INTO sales (
    sale_number,
    sale_date,
    customer_id,
    discount_mmk,
    notes,
    created_by,
    payment_status
  ) VALUES (
    v_sale_number,
    COALESCE(p_sale_date, CURRENT_DATE),
    p_customer_id,
    v_discount,
    p_notes,
    v_uid,
    'unpaid'
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_item
    FROM inventory_items
    WHERE id = (v_line->>'inventory_item_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found';
    END IF;

    v_qty := (v_line->>'quantity')::numeric;
    v_price := COALESCE((v_line->>'unit_sale_price_mmk')::numeric, 0);
    v_line_discount := COALESCE((v_line->>'line_discount_mmk')::numeric, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Sale quantity must be positive';
    END IF;

    IF v_item.item_type IN ('DECANT', 'CONSUMABLE') AND v_qty <> trunc(v_qty) THEN
      RAISE EXCEPTION 'Quantity for % must be a whole number', v_item.item_type;
    END IF;

    IF v_price < 0 OR v_line_discount < 0 THEN
      RAISE EXCEPTION 'Price/discount cannot be negative';
    END IF;

    v_line_total := round((v_price * v_qty) - v_line_discount, 2);
    IF v_line_total < 0 THEN
      RAISE EXCEPTION 'Line total cannot be negative';
    END IF;

    v_unit_cogs := apply_outbound_qty(v_item.id, v_qty);
    v_line_cogs := round(v_unit_cogs * v_qty, 2);
    v_line_profit := round(v_line_total - v_line_cogs, 2);

    v_product_type := CASE v_item.item_type
      WHEN 'PERFUME_LIQUID' THEN 'PERFUME_LIQUID'::sale_item_product_type
      WHEN 'DECANT' THEN 'DECANT'::sale_item_product_type
      WHEN 'CONSUMABLE' THEN 'CONSUMABLE'::sale_item_product_type
      ELSE 'OTHER'::sale_item_product_type
    END;

    IF v_item.perfume_id IS NOT NULL THEN
      SELECT p.name, b.name INTO v_perfume_name, v_brand_name
      FROM perfumes p
      JOIN brands b ON b.id = p.brand_id
      WHERE p.id = v_item.perfume_id;

      IF v_item.item_type = 'DECANT' THEN
        v_description := coalesce(v_brand_name, '') || ' — ' || coalesce(v_perfume_name, 'Perfume')
          || ' ' || v_item.size_ml || 'ml decant';
      ELSE
        v_description := coalesce(v_brand_name, '') || ' — ' || coalesce(v_perfume_name, 'Perfume')
          || ' liquid';
      END IF;
    ELSIF v_item.consumable_id IS NOT NULL THEN
      SELECT name INTO v_description FROM consumables WHERE id = v_item.consumable_id;
    ELSE
      v_description := 'Item';
    END IF;

    INSERT INTO sale_items (
      sale_id,
      inventory_item_id,
      product_type,
      perfume_id,
      description,
      size_ml,
      quantity,
      unit_sale_price_mmk,
      line_discount_mmk,
      line_total_mmk,
      unit_cogs_mmk,
      cogs_mmk,
      profit_mmk
    ) VALUES (
      v_sale_id,
      v_item.id,
      v_product_type,
      v_item.perfume_id,
      trim(both ' —' from v_description),
      v_item.size_ml,
      v_qty,
      v_price,
      v_line_discount,
      v_line_total,
      v_unit_cogs,
      v_line_cogs,
      v_line_profit
    )
    RETURNING id INTO v_sale_item_id;

    INSERT INTO inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      unit,
      unit_cost_mmk,
      total_cost_mmk,
      sale_id,
      sale_item_id,
      notes,
      created_by
    ) VALUES (
      v_item.id,
      'SALE',
      -v_qty,
      v_item.unit,
      v_unit_cogs,
      -v_line_cogs,
      v_sale_id,
      v_sale_item_id,
      v_sale_number,
      v_uid
    );

    v_subtotal := v_subtotal + v_line_total;
    v_cogs := v_cogs + v_line_cogs;
  END LOOP;

  IF v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Header discount cannot exceed subtotal';
  END IF;

  v_total := round(v_subtotal - v_discount, 2);

  UPDATE sales
  SET
    subtotal_mmk = round(v_subtotal, 2),
    total_mmk = v_total,
    cogs_mmk = round(v_cogs, 2),
    gross_profit_mmk = round(v_total - v_cogs, 2),
    paid_amount_mmk = 0,
    remaining_amount_mmk = v_total
  WHERE id = v_sale_id;

  IF p_initial_payment IS NOT NULL
     AND COALESCE((p_initial_payment->>'amount_mmk')::numeric, 0) > 0
  THEN
    v_pay_amount := (p_initial_payment->>'amount_mmk')::numeric;
    v_pay_method := COALESCE(
      (p_initial_payment->>'payment_method')::payment_method,
      'cash'::payment_method
    );
    v_pay_notes := NULLIF(p_initial_payment->>'notes', '');

    INSERT INTO payments (
      payment_number,
      sale_id,
      customer_id,
      payment_date,
      amount_mmk,
      payment_method,
      notes,
      created_by
    ) VALUES (
      next_doc_number('payment'),
      v_sale_id,
      p_customer_id,
      COALESCE(p_sale_date, CURRENT_DATE),
      v_pay_amount,
      v_pay_method,
      v_pay_notes,
      v_uid
    )
    RETURNING id INTO v_payment_id;

    UPDATE sales
    SET paid_amount_mmk = paid_amount_mmk + v_pay_amount
    WHERE id = v_sale_id;

    PERFORM refresh_sale_payment_status(v_sale_id);
  ELSE
    PERFORM refresh_sale_payment_status(v_sale_id);
  END IF;

  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION record_sale_payment(
  p_sale_id uuid,
  p_amount_mmk numeric,
  p_payment_method payment_method,
  p_payment_date date,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale sales%ROWTYPE;
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount_mmk IS NULL OR p_amount_mmk <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF v_sale.is_voided THEN
    RAISE EXCEPTION 'Cannot pay a voided sale';
  END IF;

  INSERT INTO payments (
    payment_number,
    sale_id,
    customer_id,
    payment_date,
    amount_mmk,
    payment_method,
    notes,
    created_by
  ) VALUES (
    next_doc_number('payment'),
    p_sale_id,
    v_sale.customer_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    p_amount_mmk,
    COALESCE(p_payment_method, 'cash'),
    p_notes,
    v_uid
  )
  RETURNING id INTO v_payment_id;

  UPDATE sales
  SET paid_amount_mmk = paid_amount_mmk + p_amount_mmk
  WHERE id = p_sale_id;

  PERFORM refresh_sale_payment_status(p_sale_id);

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION create_sale(uuid, date, numeric, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_sale_payment(uuid, numeric, payment_method, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_sale(uuid, date, numeric, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION record_sale_payment(uuid, numeric, payment_method, date, text) TO authenticated;
