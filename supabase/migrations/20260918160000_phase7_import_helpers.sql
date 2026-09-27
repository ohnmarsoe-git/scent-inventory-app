-- Phase 7: Opening perfume liquid import (ADJUSTMENT_IN + WAC)

CREATE OR REPLACE FUNCTION import_opening_perfume_liquid(
  p_perfume_id uuid,
  p_quantity_ml numeric,
  p_unit_cost_mmk numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_quantity_ml IS NULL OR p_quantity_ml <= 0 THEN
    RAISE EXCEPTION 'Quantity ml must be positive';
  END IF;

  IF p_unit_cost_mmk IS NULL OR p_unit_cost_mmk < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM perfumes WHERE id = p_perfume_id) THEN
    RAISE EXCEPTION 'Perfume not found';
  END IF;

  v_item_id := get_or_create_perfume_liquid_item(p_perfume_id);
  PERFORM apply_inbound_wac(v_item_id, p_quantity_ml, p_unit_cost_mmk);

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
    v_item_id,
    'ADJUSTMENT_IN',
    p_quantity_ml,
    'ml',
    p_unit_cost_mmk,
    round(p_quantity_ml * p_unit_cost_mmk, 2),
    COALESCE(p_notes, 'Opening stock import'),
    v_uid
  );

  RETURN v_item_id;
END;
$$;

REVOKE ALL ON FUNCTION import_opening_perfume_liquid(uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_opening_perfume_liquid(uuid, numeric, numeric, text) TO authenticated;
