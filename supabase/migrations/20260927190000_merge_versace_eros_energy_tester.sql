-- Versace Eros Energy (Tester) is the same bottle as Versace Eros Energy.
-- Merge the tester master into the main perfume so POs, stock, and sales share one cost.

DO $$
DECLARE
  v_brand_id uuid;
  v_keep_id uuid;
  v_drop_id uuid;
  v_keep_item inventory_items%ROWTYPE;
  v_drop_item inventory_items%ROWTYPE;
  v_new_qty numeric;
  v_new_avg numeric;
  r record;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE name = 'Versace' LIMIT 1;
  IF v_brand_id IS NULL THEN
    RAISE NOTICE 'Versace brand not found; skipping merge';
    RETURN;
  END IF;

  SELECT id INTO v_keep_id
  FROM perfumes
  WHERE brand_id = v_brand_id
    AND name = 'Versace Eros Energy'
  LIMIT 1;

  SELECT id INTO v_drop_id
  FROM perfumes
  WHERE brand_id = v_brand_id
    AND name = 'Versace Eros Energy (Tester)'
  LIMIT 1;

  IF v_keep_id IS NULL THEN
    RAISE NOTICE 'Versace Eros Energy not found; skipping merge';
    RETURN;
  END IF;

  IF v_drop_id IS NULL THEN
    RAISE NOTICE 'Versace Eros Energy (Tester) not found; already merged?';
    RETURN;
  END IF;

  UPDATE purchase_order_items
  SET perfume_id = v_keep_id
  WHERE perfume_id = v_drop_id;

  UPDATE purchase_receipt_items
  SET perfume_id = v_keep_id
  WHERE perfume_id = v_drop_id;

  UPDATE sale_items
  SET perfume_id = v_keep_id
  WHERE perfume_id = v_drop_id;

  UPDATE decant_transactions
  SET perfume_id = v_keep_id
  WHERE perfume_id = v_drop_id;

  -- Price list: move sizes that do not already exist on keep.
  UPDATE price_list_entries AS src
  SET perfume_id = v_keep_id
  WHERE src.perfume_id = v_drop_id
    AND NOT EXISTS (
      SELECT 1
      FROM price_list_entries AS dst
      WHERE dst.perfume_id = v_keep_id
        AND dst.size_ml = src.size_ml
    );

  DELETE FROM price_list_entries
  WHERE perfume_id = v_drop_id;

  -- Merge liquid stock (WAC) and retarget movements.
  SELECT * INTO v_keep_item
  FROM inventory_items
  WHERE perfume_id = v_keep_id
    AND item_type = 'PERFUME_LIQUID'
  FOR UPDATE;

  SELECT * INTO v_drop_item
  FROM inventory_items
  WHERE perfume_id = v_drop_id
    AND item_type = 'PERFUME_LIQUID'
  FOR UPDATE;

  IF v_drop_item.id IS NOT NULL THEN
    IF v_keep_item.id IS NULL THEN
      UPDATE inventory_items
      SET perfume_id = v_keep_id
      WHERE id = v_drop_item.id;
    ELSE
      v_new_qty := v_keep_item.quantity_on_hand + v_drop_item.quantity_on_hand;
      IF v_new_qty = 0 THEN
        v_new_avg := 0;
      ELSE
        v_new_avg := round(
          (
            (v_keep_item.quantity_on_hand * v_keep_item.avg_unit_cost_mmk)
            + (v_drop_item.quantity_on_hand * v_drop_item.avg_unit_cost_mmk)
          ) / v_new_qty,
          6
        );
      END IF;

      UPDATE inventory_movements
      SET inventory_item_id = v_keep_item.id
      WHERE inventory_item_id = v_drop_item.id;

      UPDATE inventory_items
      SET
        quantity_on_hand = v_new_qty,
        avg_unit_cost_mmk = GREATEST(v_new_avg, 0),
        updated_at = now()
      WHERE id = v_keep_item.id;

      DELETE FROM inventory_items
      WHERE id = v_drop_item.id;
    END IF;
  END IF;

  -- Decants: retarget or merge same size.
  FOR r IN
    SELECT *
    FROM inventory_items
    WHERE perfume_id = v_drop_id
      AND item_type = 'DECANT'
    FOR UPDATE
  LOOP
    SELECT * INTO v_keep_item
    FROM inventory_items
    WHERE perfume_id = v_keep_id
      AND item_type = 'DECANT'
      AND size_ml = r.size_ml
    FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE inventory_items
      SET perfume_id = v_keep_id
      WHERE id = r.id;
    ELSE
      v_new_qty := v_keep_item.quantity_on_hand + r.quantity_on_hand;
      IF v_new_qty = 0 THEN
        v_new_avg := 0;
      ELSE
        v_new_avg := round(
          (
            (v_keep_item.quantity_on_hand * v_keep_item.avg_unit_cost_mmk)
            + (r.quantity_on_hand * r.avg_unit_cost_mmk)
          ) / v_new_qty,
          6
        );
      END IF;

      UPDATE inventory_movements
      SET inventory_item_id = v_keep_item.id
      WHERE inventory_item_id = r.id;

      UPDATE inventory_items
      SET
        quantity_on_hand = v_new_qty,
        avg_unit_cost_mmk = GREATEST(v_new_avg, 0),
        updated_at = now()
      WHERE id = v_keep_item.id;

      DELETE FROM inventory_items
      WHERE id = r.id;
    END IF;
  END LOOP;

  DELETE FROM perfumes
  WHERE id = v_drop_id;
END;
$$;
