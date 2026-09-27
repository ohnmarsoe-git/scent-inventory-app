-- PO-2026-00027 (Jimmy Choo I want Choo): shipping 4,000 MMK.
-- Currency is MMK, so original and MMK shipping are both 4,000.
-- Total is rebuilt from subtotal + shipping + other costs.
-- If the bottle was already received, liquid cost picks up the same shipping.

DO $$
DECLARE
  v_po purchase_orders%ROWTYPE;
  v_goods numeric;
  v_item inventory_items%ROWTYPE;
  v_new_line numeric;
  v_new_unit numeric;
  v_value numeric;
  r record;
BEGIN
  SELECT * INTO v_po
  FROM purchase_orders
  WHERE po_number = 'PO-2026-00027'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order PO-2026-00027 was not found';
  END IF;

  UPDATE purchase_orders
  SET
    shipping_cost_original = 4000,
    shipping_cost_mmk = 4000,
    total_original = subtotal_original + 4000 + other_cost_original,
    total_mmk = subtotal_mmk + 4000 + other_cost_mmk
  WHERE id = v_po.id;

  SELECT COALESCE(SUM(line_total_mmk), 0) INTO v_goods
  FROM purchase_order_items
  WHERE purchase_order_id = v_po.id;

  FOR r IN
    SELECT
      pri.id,
      pri.quantity_ml,
      pri.quantity_bottles,
      pri.unit_cost_mmk_per_ml,
      pri.perfume_id,
      pri.purchase_receipt_id,
      poi.unit_cost_mmk,
      poi.quantity AS ordered_qty,
      poi.line_total_mmk
    FROM purchase_receipt_items pri
    JOIN purchase_receipts pr ON pr.id = pri.purchase_receipt_id
    JOIN purchase_order_items poi ON poi.id = pri.purchase_order_item_id
    WHERE pr.purchase_order_id = v_po.id
  LOOP
    v_new_line := round(
      (r.unit_cost_mmk * r.quantity_bottles)
      + (
        (4000 + v_po.other_cost_mmk)
        * (CASE WHEN v_goods > 0 THEN r.line_total_mmk / v_goods ELSE 0 END)
        * (r.quantity_bottles / NULLIF(r.ordered_qty, 0))
      ),
      2
    );
    v_new_unit := CASE
      WHEN r.quantity_ml = 0 THEN 0
      ELSE round(v_new_line / r.quantity_ml, 6)
    END;

    SELECT * INTO v_item
    FROM inventory_items
    WHERE perfume_id = r.perfume_id
      AND item_type = 'PERFUME_LIQUID'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Perfume liquid not found for %', r.perfume_id;
    END IF;

    IF v_item.quantity_on_hand = 0 THEN
      v_value := 0;
    ELSE
      v_value := round(
        (
          (v_item.quantity_on_hand * v_item.avg_unit_cost_mmk)
          - (r.quantity_ml * r.unit_cost_mmk_per_ml)
          + (r.quantity_ml * v_new_unit)
        ) / v_item.quantity_on_hand,
        6
      );
    END IF;

    UPDATE inventory_items
    SET
      avg_unit_cost_mmk = GREATEST(v_value, 0),
      updated_at = now()
    WHERE id = v_item.id;

    UPDATE purchase_receipt_items
    SET
      line_cost_mmk = v_new_line,
      unit_cost_mmk_per_ml = v_new_unit
    WHERE id = r.id;

    UPDATE inventory_movements
    SET
      unit_cost_mmk = v_new_unit,
      total_cost_mmk = v_new_line
    WHERE purchase_receipt_id = r.purchase_receipt_id
      AND inventory_item_id = v_item.id
      AND movement_type = 'PURCHASE_RECEIPT';
  END LOOP;
END;
$$;
