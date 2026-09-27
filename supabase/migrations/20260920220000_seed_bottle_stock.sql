-- Empty bottles, caps, and packaging from docs/Bottle Stock_all.xlsx.
-- One consumable per item. Each sheet row is a purchase receipt (weighted average).
-- Qty Bought is on-hand stock; the sheet has no "used" column.
--
-- Delivery:
--   5ml bottle, 50 pcs (2026-09-05): unit cost 2,080 already includes 4,000 delivery.
--     Sheet total 100,000 is before delivery (50 × 2,000). Landed line is 104,000.
--   2ml bottle: unit cost 900 × 50 = 45,000, plus 4,000 delivery. Landed unit is 980.
--
-- Sheet issues kept as notes, not guessed away:
--   Aluminum bag total is 2,900, which is not 10 × 500. Stock uses unit cost 500.
--   Several cap rows have no purchase date. One 5ml cap date cell is 5 (not a date).
--   Sheet spellings: "Alumimum bag", category "packging", category "others".
--
-- Safe to run again: each row is keyed by [bottle-stock:NN].

INSERT INTO suppliers (name)
VALUES ('Scent by Htet')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  r record;
  v_key text;
  v_notes text;
  v_cons_id uuid;
  v_item_id uuid;
  v_supplier_id uuid;
BEGIN
  FOR r IN
    SELECT *
    FROM (
      VALUES
        (2, '3ml bottle', 'bottle', DATE '2026-05-13', 30::numeric, NULL::text, 800::numeric, 24000::numeric,
          'No total on the sheet. Used unit cost 800.'),
        (12, '5ml bottle', 'bottle', DATE '2026-05-08', 10, NULL, 2200, 22000,
          'Sheet bottle type: 5ml.'),
        (6, '5ml bottle', 'bottle', DATE '2026-09-05', 50, 'Scent by Htet', 2080, 104000,
          'Supplier: Scent by Htet. Delivery 4,000 is already in unit cost 2,080. Sheet total 100,000 is before delivery.'),
        (11, '10ml bottle', 'bottle', DATE '2026-05-08', 10, NULL, 2450, 24500,
          'Sheet bottle type: 10ml.'),
        (7, '10ml bottle', 'bottle', DATE '2026-07-05', 50, NULL, 2900, 145000,
          'Sheet bottle type: 10ml.'),
        (8, '2ml bottle', 'bottle', DATE '2026-09-06', 50, NULL, 980, 49000,
          'Sheet unit cost 900. Delivery 4,000 added (50 × 900 + 4,000).'),
        (18, '20ml bottle', 'bottle', DATE '2026-05-13', 12, NULL, 4200, 50400,
          'Sheet bottle type: 20ml.'),
        (4, '5ml cap', 'cap', NULL::date, 5, NULL, 3400, 17000,
          'Purchase date was blank. No total on the sheet. Used unit cost 3,400.'),
        (13, '5ml cap', 'cap', NULL::date, 5, NULL, 3500, 17500,
          'Purchase date cell was 5, not a date. Left blank.'),
        (14, '5ml cap', 'cap', DATE '2026-06-07', 10, NULL, 3400, 34000,
          'Sheet bottle type: 5ml cap.'),
        (3, '10ml cap', 'cap', NULL::date, 5, NULL, 4300, 21500,
          'Purchase date was blank. No total on the sheet. Used unit cost 4,300.'),
        (5, '10ml cap', 'cap', NULL::date, 5, NULL, 3800, 19000,
          'Purchase date was blank. No total on the sheet. Used unit cost 3,800.'),
        (15, '10ml cap', 'cap', DATE '2026-06-07', 5, NULL, 3500, 17500,
          'Sheet bottle type: 10ml cap.'),
        (16, '10ml cap', 'cap', DATE '2026-06-07', 5, NULL, 4000, 20000,
          'Sheet bottle type: 10ml cap.'),
        (17, '10ml twist', 'cap', DATE '2026-05-13', 12, NULL, 5500, 66000,
          'Sheet bottle type: 10ml twist.'),
        (9, 'Tester paper', 'other', DATE '2026-09-06', 2, NULL, 4000, 8000,
          'Sheet category: others.'),
        (10, 'Aluminum bag', 'packaging', DATE '2026-09-06', 10, NULL, 500, 5000,
          'Sheet name: Alumimum bag. Sheet category: packging. Total Cost 2,900 is not 10 × 500. Stock uses unit cost 500.')
    ) AS t(
      row_no,
      name,
      category,
      purchase_date,
      qty,
      supplier,
      unit_cost,
      line_total,
      detail
    )
    ORDER BY purchase_date NULLS LAST, row_no
  LOOP
    v_key := '[bottle-stock:' || lpad(r.row_no::text, 2, '0') || ']';
    IF EXISTS (
      SELECT 1 FROM inventory_movements WHERE notes LIKE v_key || '%'
    ) THEN
      CONTINUE;
    END IF;

    v_notes := v_key || ' ' || r.detail;

    SELECT id INTO v_cons_id FROM consumables WHERE name = r.name;
    IF v_cons_id IS NULL THEN
      INSERT INTO consumables (
        name,
        category,
        unit,
        purchase_price_mmk,
        quantity_purchased,
        cost_per_unit_mmk,
        notes
      ) VALUES (
        r.name,
        r.category,
        'each',
        0,
        0,
        0,
        'From docs/Bottle Stock_all.xlsx'
      )
      RETURNING id INTO v_cons_id;
    END IF;

    IF r.supplier IS NOT NULL THEN
      SELECT id INTO v_supplier_id FROM suppliers WHERE name = r.supplier;
      IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found: %', r.supplier;
      END IF;
      UPDATE consumables
      SET supplier_id = v_supplier_id
      WHERE id = v_cons_id
        AND supplier_id IS NULL;
    END IF;

    SELECT id INTO v_item_id
    FROM inventory_items
    WHERE item_type = 'CONSUMABLE'
      AND consumable_id = v_cons_id;

    IF v_item_id IS NULL THEN
      INSERT INTO inventory_items (
        item_type,
        consumable_id,
        unit,
        quantity_on_hand,
        avg_unit_cost_mmk
      ) VALUES (
        'CONSUMABLE',
        v_cons_id,
        'each',
        0,
        0
      )
      RETURNING id INTO v_item_id;
    END IF;

    PERFORM apply_inbound_wac(v_item_id, r.qty, r.unit_cost);

    INSERT INTO inventory_movements (
      inventory_item_id,
      moved_at,
      movement_type,
      quantity,
      unit,
      unit_cost_mmk,
      total_cost_mmk,
      notes
    ) VALUES (
      v_item_id,
      COALESCE(r.purchase_date::timestamptz, now()),
      'PURCHASE_RECEIPT',
      r.qty,
      'each',
      r.unit_cost,
      r.line_total,
      v_notes
    );

    UPDATE consumables
    SET
      quantity_purchased = quantity_purchased + r.qty,
      purchase_price_mmk = purchase_price_mmk + r.line_total,
      cost_per_unit_mmk = (
        SELECT avg_unit_cost_mmk FROM inventory_items WHERE id = v_item_id
      ),
      updated_at = now()
    WHERE id = v_cons_id;
  END LOOP;
END;
$$;
