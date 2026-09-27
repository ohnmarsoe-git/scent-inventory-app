-- Cap bottle extra is added to sale COGS and the line description.
-- The sell price already includes the extra from the sale form.

CREATE OR REPLACE FUNCTION create_sale_order(
  p_customer_id uuid,
  p_sale_date date,
  p_notes text,
  p_lines jsonb,
  p_pay_now boolean DEFAULT true,
  p_payment_method payment_method DEFAULT 'mobile_wallet'
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
  v_perfume_id uuid;
  v_size numeric;
  v_qty numeric;
  v_price numeric;
  v_ml numeric;
  v_source_id uuid;
  v_source inventory_items%ROWTYPE;
  v_cost_per_ml numeric;
  v_unit_cogs numeric;
  v_line_cogs numeric;
  v_line_total numeric;
  v_line_profit numeric;
  v_subtotal numeric := 0;
  v_cogs numeric := 0;
  v_total numeric;
  v_sale_item_id uuid;
  v_perfume_name text;
  v_brand_name text;
  v_description text;
  v_cap numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one line';
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
    0,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_uid,
    'unpaid'
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_perfume_id := (v_line->>'perfume_id')::uuid;
    v_size := (v_line->>'size_ml')::numeric;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := COALESCE((v_line->>'unit_sale_price_mmk')::numeric, 0);

    IF v_perfume_id IS NULL THEN
      RAISE EXCEPTION 'Select a scent';
    END IF;
    IF v_size IS NULL OR v_size <= 0 THEN
      RAISE EXCEPTION 'Decant size must be positive';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty <> trunc(v_qty) THEN
      RAISE EXCEPTION 'Quantity must be a whole number';
    END IF;
    IF v_price < 0 THEN
      RAISE EXCEPTION 'Price cannot be negative';
    END IF;

    v_ml := v_size * v_qty;
    v_source_id := get_or_create_perfume_liquid_item(v_perfume_id);
    SELECT * INTO v_source FROM inventory_items WHERE id = v_source_id FOR UPDATE;

    IF v_source.quantity_on_hand < v_ml THEN
      SELECT p.name, b.name INTO v_perfume_name, v_brand_name
      FROM perfumes p
      JOIN brands b ON b.id = p.brand_id
      WHERE p.id = v_perfume_id;

      RAISE EXCEPTION 'Not enough liquid for % (have % ml, need % ml)',
        trim(both ' —' FROM coalesce(v_brand_name, '') || ' — ' || coalesce(v_perfume_name, 'perfume')),
        v_source.quantity_on_hand,
        v_ml;
    END IF;

    v_cost_per_ml := apply_outbound_qty(v_source_id, v_ml);
    v_cap := 0;
    IF lower(COALESCE(v_line->>'with_cap', '')) IN ('true', 't', '1') THEN
      v_cap := GREATEST(COALESCE((v_line->>'cap_extra_mmk')::numeric, 0), 0);
    END IF;
    v_unit_cogs := round(v_cost_per_ml * v_size + v_cap, 2);
    v_line_cogs := round(v_unit_cogs * v_qty, 2);
    v_line_total := round(v_price * v_qty, 2);
    v_line_profit := round(v_line_total - v_line_cogs, 2);

    SELECT p.name, b.name INTO v_perfume_name, v_brand_name
    FROM perfumes p
    JOIN brands b ON b.id = p.brand_id
    WHERE p.id = v_perfume_id;

    v_description := trim(both ' —' FROM coalesce(v_brand_name, '') || ' — ' || coalesce(v_perfume_name, 'Perfume'))
      || ' ' || v_size || 'ml';
    IF v_cap > 0 THEN
      v_description := v_description || ' · cap';
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
      v_source_id,
      'DECANT',
      v_perfume_id,
      v_description,
      v_size,
      v_qty,
      v_price,
      0,
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
      v_source_id,
      'SALE',
      -v_ml,
      'ml',
      v_cost_per_ml,
      -round(v_cost_per_ml * v_ml, 2),
      v_sale_id,
      v_sale_item_id,
      v_sale_number || ' poured ' || v_qty || ' × ' || v_size || 'ml',
      v_uid
    );

    v_subtotal := v_subtotal + v_line_total;
    v_cogs := v_cogs + v_line_cogs;
  END LOOP;

  v_total := round(v_subtotal, 2);

  UPDATE sales
  SET
    subtotal_mmk = v_total,
    total_mmk = v_total,
    cogs_mmk = round(v_cogs, 2),
    gross_profit_mmk = round(v_total - v_cogs, 2),
    paid_amount_mmk = 0,
    remaining_amount_mmk = v_total
  WHERE id = v_sale_id;

  IF COALESCE(p_pay_now, false) AND v_total > 0 THEN
    INSERT INTO payments (
      payment_number,
      sale_id,
      customer_id,
      payment_date,
      amount_mmk,
      payment_method,
      created_by
    ) VALUES (
      next_doc_number('payment'),
      v_sale_id,
      p_customer_id,
      COALESCE(p_sale_date, CURRENT_DATE),
      v_total,
      COALESCE(p_payment_method, 'mobile_wallet'),
      v_uid
    );

    UPDATE sales
    SET paid_amount_mmk = v_total
    WHERE id = v_sale_id;
  END IF;

  PERFORM refresh_sale_payment_status(v_sale_id);
  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION create_sale_order(uuid, date, text, jsonb, boolean, payment_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_sale_order(uuid, date, text, jsonb, boolean, payment_method) TO authenticated;
