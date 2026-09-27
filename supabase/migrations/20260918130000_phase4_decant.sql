-- Phase 4: Decanting + automatic COGS (WAC)

CREATE OR REPLACE FUNCTION get_or_create_decant_item(
  p_perfume_id uuid,
  p_size_ml numeric
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_size_ml IS NULL OR p_size_ml <= 0 THEN
    RAISE EXCEPTION 'Decant size must be positive';
  END IF;

  SELECT id INTO v_id
  FROM inventory_items
  WHERE item_type = 'DECANT'
    AND perfume_id = p_perfume_id
    AND size_ml = p_size_ml;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO inventory_items (
    item_type, perfume_id, size_ml, unit, quantity_on_hand, avg_unit_cost_mmk
  ) VALUES (
    'DECANT', p_perfume_id, p_size_ml, 'each', 0, 0
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_or_create_consumable_item(p_consumable_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_cons consumables%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  SELECT id INTO v_id
  FROM inventory_items
  WHERE item_type = 'CONSUMABLE' AND consumable_id = p_consumable_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT * INTO v_cons FROM consumables WHERE id = p_consumable_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consumable not found';
  END IF;

  -- Opening balance from master quantity_purchased (one-time seed).
  INSERT INTO inventory_items (
    item_type, consumable_id, unit, quantity_on_hand, avg_unit_cost_mmk
  ) VALUES (
    'CONSUMABLE',
    p_consumable_id,
    v_cons.unit,
    COALESCE(v_cons.quantity_purchased, 0),
    COALESCE(v_cons.cost_per_unit_mmk, 0)
  )
  RETURNING id INTO v_id;

  IF COALESCE(v_cons.quantity_purchased, 0) > 0 THEN
    INSERT INTO inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      unit,
      unit_cost_mmk,
      total_cost_mmk,
      notes,
      created_by
    ) VALUES (
      v_id,
      'ADJUSTMENT_IN',
      v_cons.quantity_purchased,
      v_cons.unit,
      COALESCE(v_cons.cost_per_unit_mmk, 0),
      round(COALESCE(v_cons.quantity_purchased, 0) * COALESCE(v_cons.cost_per_unit_mmk, 0), 2),
      'Opening consumable stock from master',
      v_uid
    );
  END IF;

  RETURN v_id;
END;
$$;

-- Create a decant transaction.
-- p_outputs: [
--   {
--     size_ml, quantity,
--     consumables: [{ consumable_id, quantity_per_unit }]  -- optional
--   }
-- ]
CREATE OR REPLACE FUNCTION create_decant_transaction(
  p_perfume_id uuid,
  p_notes text,
  p_outputs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source inventory_items%ROWTYPE;
  v_source_id uuid;
  v_decant_id uuid;
  v_decant_number text;
  v_output jsonb;
  v_cons jsonb;
  v_size numeric;
  v_qty numeric;
  v_liquid_needed numeric := 0;
  v_liquid_cost_per_ml numeric;
  v_liquid_total numeric;
  v_unit_cost numeric;
  v_perfume_cost_per_unit numeric;
  v_packaging_per_unit numeric;
  v_packaging_line_total numeric;
  v_unit_cogs numeric;
  v_total_cogs numeric;
  v_decant_item_id uuid;
  v_decant_line_id uuid;
  v_cons_id uuid;
  v_cons_inv_id uuid;
  v_cons_per_unit numeric;
  v_cons_qty numeric;
  v_cons_unit_cost numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_outputs IS NULL OR jsonb_array_length(p_outputs) = 0 THEN
    RAISE EXCEPTION 'Add at least one decant output';
  END IF;

  v_source_id := get_or_create_perfume_liquid_item(p_perfume_id);
  SELECT * INTO v_source FROM inventory_items WHERE id = v_source_id FOR UPDATE;

  FOR v_output IN SELECT * FROM jsonb_array_elements(p_outputs)
  LOOP
    v_size := (v_output->>'size_ml')::numeric;
    v_qty := (v_output->>'quantity')::numeric;
    IF v_size IS NULL OR v_size <= 0 THEN
      RAISE EXCEPTION 'Decant size must be positive';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty <> trunc(v_qty) THEN
      RAISE EXCEPTION 'Decant quantity must be a positive whole number';
    END IF;
    v_liquid_needed := v_liquid_needed + (v_size * v_qty);
  END LOOP;

  IF v_source.quantity_on_hand < v_liquid_needed THEN
    RAISE EXCEPTION 'Insufficient liquid stock (have % ml, need % ml)',
      v_source.quantity_on_hand, v_liquid_needed;
  END IF;

  v_liquid_cost_per_ml := v_source.avg_unit_cost_mmk;
  v_liquid_total := round(v_liquid_needed * v_liquid_cost_per_ml, 2);
  v_decant_number := next_doc_number('decant');

  INSERT INTO decant_transactions (
    decant_number,
    perfume_id,
    source_inventory_item_id,
    liquid_ml_used,
    liquid_unit_cost_mmk,
    liquid_total_cost_mmk,
    notes,
    created_by
  ) VALUES (
    v_decant_number,
    p_perfume_id,
    v_source_id,
    v_liquid_needed,
    v_liquid_cost_per_ml,
    v_liquid_total,
    p_notes,
    v_uid
  )
  RETURNING id INTO v_decant_id;

  -- Deduct perfume liquid
  v_unit_cost := apply_outbound_qty(v_source_id, v_liquid_needed);

  INSERT INTO inventory_movements (
    inventory_item_id,
    movement_type,
    quantity,
    unit,
    unit_cost_mmk,
    total_cost_mmk,
    decant_transaction_id,
    notes,
    created_by
  ) VALUES (
    v_source_id,
    'DECANT_OUT',
    -v_liquid_needed,
    'ml',
    v_unit_cost,
    -round(v_liquid_needed * v_unit_cost, 2),
    v_decant_id,
    'Decant ' || v_decant_number,
    v_uid
  );

  FOR v_output IN SELECT * FROM jsonb_array_elements(p_outputs)
  LOOP
    v_size := (v_output->>'size_ml')::numeric;
    v_qty := (v_output->>'quantity')::numeric;
    v_perfume_cost_per_unit := round(v_size * v_liquid_cost_per_ml, 4);
    v_packaging_per_unit := 0;
    v_packaging_line_total := 0;

    v_decant_item_id := get_or_create_decant_item(p_perfume_id, v_size);

    -- Insert decant_items first with packaging 0; update after consumables
    INSERT INTO decant_items (
      decant_transaction_id,
      inventory_item_id,
      size_ml,
      quantity,
      perfume_cost_mmk,
      packaging_cost_mmk,
      unit_cogs_mmk,
      total_cogs_mmk
    ) VALUES (
      v_decant_id,
      v_decant_item_id,
      v_size,
      v_qty,
      round(v_perfume_cost_per_unit * v_qty, 2),
      0,
      v_perfume_cost_per_unit,
      round(v_perfume_cost_per_unit * v_qty, 2)
    )
    RETURNING id INTO v_decant_line_id;

    IF v_output ? 'consumables'
       AND jsonb_typeof(v_output->'consumables') = 'array'
       AND jsonb_array_length(v_output->'consumables') > 0
    THEN
      FOR v_cons IN SELECT * FROM jsonb_array_elements(v_output->'consumables')
      LOOP
        v_cons_id := (v_cons->>'consumable_id')::uuid;
        v_cons_per_unit := COALESCE((v_cons->>'quantity_per_unit')::numeric, 1);
        IF v_cons_per_unit <= 0 THEN
          RAISE EXCEPTION 'Consumable quantity per unit must be positive';
        END IF;

        v_cons_qty := v_cons_per_unit * v_qty;
        v_cons_inv_id := get_or_create_consumable_item(v_cons_id);
        v_cons_unit_cost := apply_outbound_qty(v_cons_inv_id, v_cons_qty);

        INSERT INTO decant_consumable_usages (
          decant_transaction_id,
          decant_item_id,
          consumable_id,
          inventory_item_id,
          quantity,
          unit_cost_mmk,
          total_cost_mmk
        ) VALUES (
          v_decant_id,
          v_decant_line_id,
          v_cons_id,
          v_cons_inv_id,
          v_cons_qty,
          v_cons_unit_cost,
          round(v_cons_qty * v_cons_unit_cost, 2)
        );

        INSERT INTO inventory_movements (
          inventory_item_id,
          movement_type,
          quantity,
          unit,
          unit_cost_mmk,
          total_cost_mmk,
          decant_transaction_id,
          notes,
          created_by
        )
        SELECT
          v_cons_inv_id,
          'OTHER',
          -v_cons_qty,
          ii.unit,
          v_cons_unit_cost,
          -round(v_cons_qty * v_cons_unit_cost, 2),
          v_decant_id,
          'Packaging for ' || v_decant_number,
          v_uid
        FROM inventory_items ii
        WHERE ii.id = v_cons_inv_id;

        v_packaging_per_unit := v_packaging_per_unit + (v_cons_per_unit * v_cons_unit_cost);
        v_packaging_line_total := v_packaging_line_total + (v_cons_qty * v_cons_unit_cost);
      END LOOP;
    END IF;

    v_unit_cogs := round(v_perfume_cost_per_unit + v_packaging_per_unit, 4);
    v_total_cogs := round(v_unit_cogs * v_qty, 2);

    UPDATE decant_items
    SET
      packaging_cost_mmk = round(v_packaging_line_total, 2),
      unit_cogs_mmk = v_unit_cogs,
      total_cogs_mmk = v_total_cogs
    WHERE id = v_decant_line_id;

    PERFORM apply_inbound_wac(v_decant_item_id, v_qty, v_unit_cogs);

    INSERT INTO inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      unit,
      unit_cost_mmk,
      total_cost_mmk,
      decant_transaction_id,
      notes,
      created_by
    ) VALUES (
      v_decant_item_id,
      'DECANT_IN',
      v_qty,
      'each',
      v_unit_cogs,
      v_total_cogs,
      v_decant_id,
      v_size || 'ml × ' || v_qty || ' (' || v_decant_number || ')',
      v_uid
    );
  END LOOP;

  RETURN v_decant_id;
END;
$$;

REVOKE ALL ON FUNCTION create_decant_transaction(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_decant_transaction(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_decant_item(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_consumable_item(uuid) TO authenticated;
