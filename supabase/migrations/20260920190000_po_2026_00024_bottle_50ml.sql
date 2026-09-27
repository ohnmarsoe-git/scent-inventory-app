-- PO-2026-00024 (Miss Dior Blomming Bouquet, still on the way) is 50ml.
-- The earlier Miss Dior bottle that is already in stock stays 30ml.
-- Purchase money is unchanged. If a receipt already posted 30ml, restock it as 50ml.

DO $$
DECLARE
  v_po_id uuid;
  v_item inventory_items%ROWTYPE;
  v_new_ml numeric;
  v_new_unit numeric;
  v_qty numeric;
  v_value numeric;
  r record;
BEGIN
  SELECT id INTO v_po_id
  FROM purchase_orders
  WHERE po_number = 'PO-2026-00024';

  IF v_po_id IS NULL THEN
    RAISE EXCEPTION 'Purchase order PO-2026-00024 was not found';
  END IF;

  UPDATE purchase_order_items
  SET bottle_size_ml = 50
  WHERE purchase_order_id = v_po_id;

  FOR r IN
    SELECT
      pri.id,
      pri.quantity_bottles,
      pri.quantity_ml,
      pri.unit_cost_mmk_per_ml,
      pri.line_cost_mmk,
      pri.perfume_id,
      pri.purchase_receipt_id
    FROM purchase_receipt_items pri
    JOIN purchase_receipts pr ON pr.id = pri.purchase_receipt_id
    WHERE pr.purchase_order_id = v_po_id
      AND pri.bottle_size_ml IS DISTINCT FROM 50
  LOOP
    v_new_ml := r.quantity_bottles * 50;
    v_new_unit := CASE
      WHEN v_new_ml = 0 THEN 0
      ELSE round(r.line_cost_mmk / v_new_ml, 6)
    END;

    SELECT * INTO v_item
    FROM inventory_items
    WHERE perfume_id = r.perfume_id
      AND item_type = 'PERFUME_LIQUID'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Perfume liquid not found for %', r.perfume_id;
    END IF;

    IF v_item.quantity_on_hand + 0.0001 < r.quantity_ml THEN
      RAISE EXCEPTION
        'Cannot resize PO-2026-00024: only % ml left, receipt posted % ml',
        v_item.quantity_on_hand, r.quantity_ml;
    END IF;

    v_qty := v_item.quantity_on_hand - r.quantity_ml + v_new_ml;
    IF v_qty = 0 THEN
      v_value := 0;
    ELSE
      v_value := round(
        (
          (v_item.quantity_on_hand * v_item.avg_unit_cost_mmk)
          - (r.quantity_ml * r.unit_cost_mmk_per_ml)
          + (v_new_ml * v_new_unit)
        ) / v_qty,
        6
      );
    END IF;

    UPDATE inventory_items
    SET
      quantity_on_hand = v_qty,
      avg_unit_cost_mmk = GREATEST(v_value, 0),
      updated_at = now()
    WHERE id = v_item.id;

    UPDATE purchase_receipt_items
    SET
      bottle_size_ml = 50,
      quantity_ml = v_new_ml,
      unit_cost_mmk_per_ml = v_new_unit
    WHERE id = r.id;

    UPDATE inventory_movements
    SET
      quantity = v_new_ml,
      unit_cost_mmk = v_new_unit,
      notes = 'Receive ' || trim(to_char(r.quantity_bottles, 'FM999990.##')) || ' × 50ml'
    WHERE purchase_receipt_id = r.purchase_receipt_id
      AND inventory_item_id = v_item.id
      AND movement_type = 'PURCHASE_RECEIPT';
  END LOOP;
END;
$$;
