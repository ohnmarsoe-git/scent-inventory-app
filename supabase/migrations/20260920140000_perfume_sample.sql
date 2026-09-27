-- Pour a tester. Deducts perfume millilitres and records a SAMPLE movement.
-- Not a sale: no revenue. The liquid cost is the tester cost on profit and loss.

CREATE OR REPLACE FUNCTION record_perfume_sample(
  p_perfume_id uuid,
  p_size_ml numeric,
  p_quantity integer,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source_id uuid;
  v_source inventory_items%ROWTYPE;
  v_ml numeric;
  v_unit_cost numeric;
  v_move_id uuid;
  v_perfume_name text;
  v_brand_name text;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_perfume_id IS NULL THEN
    RAISE EXCEPTION 'Select a scent';
  END IF;
  IF p_size_ml IS NULL OR p_size_ml <= 0 THEN
    RAISE EXCEPTION 'Tester size must be positive';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  v_ml := round(p_size_ml * p_quantity, 4);
  v_source_id := get_or_create_perfume_liquid_item(p_perfume_id);
  SELECT * INTO v_source FROM inventory_items WHERE id = v_source_id FOR UPDATE;

  SELECT p.name, b.name INTO v_perfume_name, v_brand_name
  FROM perfumes p
  JOIN brands b ON b.id = p.brand_id
  WHERE p.id = p_perfume_id;

  v_label := trim(both ' —' FROM coalesce(v_brand_name, '') || ' — ' || coalesce(v_perfume_name, 'perfume'));

  IF v_source.quantity_on_hand + 0.0001 < v_ml THEN
    RAISE EXCEPTION 'Not enough liquid for % (have % ml, need % ml)',
      v_label, v_source.quantity_on_hand, v_ml;
  END IF;

  v_unit_cost := apply_outbound_qty(v_source_id, v_ml);

  v_label := v_label || ' tester ' || trim(to_char(p_size_ml, 'FM999990.00')) || 'ml × ' || p_quantity;
  IF NULLIF(trim(COALESCE(p_notes, '')), '') IS NOT NULL THEN
    v_label := v_label || ' · ' || trim(p_notes);
  END IF;

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
    v_source_id,
    'SAMPLE',
    -v_ml,
    'ml',
    v_unit_cost,
    -round(v_ml * v_unit_cost, 2),
    v_label,
    v_uid
  )
  RETURNING id INTO v_move_id;

  RETURN v_move_id;
END;
$$;

REVOKE ALL ON FUNCTION record_perfume_sample(uuid, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_perfume_sample(uuid, numeric, integer, text) TO authenticated;
