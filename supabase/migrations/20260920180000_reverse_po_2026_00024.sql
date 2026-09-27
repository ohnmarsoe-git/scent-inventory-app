-- PO-2026-00024 (Miss Dior Blomming Bouquet) is still on the way.
-- A receipt posted 30ml into the same liquid as the earlier Miss Dior bottle.
-- Undo that receipt only. Leave the other 30ml and its cost in stock.
-- Shipping and the deposit on this order are left as they are.

DO $$
DECLARE
  v_po_id uuid;
  v_item inventory_items%ROWTYPE;
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

  FOR r IN
    SELECT
      pri.quantity_ml,
      pri.unit_cost_mmk_per_ml,
      pri.perfume_id
    FROM purchase_receipt_items pri
    JOIN purchase_receipts pr ON pr.id = pri.purchase_receipt_id
    WHERE pr.purchase_order_id = v_po_id
  LOOP
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
        'Cannot reverse PO-2026-00024: only % ml left, receipt added % ml',
        v_item.quantity_on_hand, r.quantity_ml;
    END IF;

    v_qty := v_item.quantity_on_hand - r.quantity_ml;
    IF v_qty = 0 THEN
      v_value := 0;
    ELSE
      v_value := round(
        (
          (v_item.quantity_on_hand * v_item.avg_unit_cost_mmk)
          - (r.quantity_ml * r.unit_cost_mmk_per_ml)
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
  END LOOP;

  DELETE FROM inventory_movements
  WHERE purchase_receipt_id IN (
    SELECT id FROM purchase_receipts WHERE purchase_order_id = v_po_id
  );

  DELETE FROM purchase_receipts
  WHERE purchase_order_id = v_po_id;

  UPDATE purchase_order_items
  SET received_quantity = 0
  WHERE purchase_order_id = v_po_id;

  UPDATE purchase_orders
  SET status = 'ordered'
  WHERE id = v_po_id;
END;
$$;
