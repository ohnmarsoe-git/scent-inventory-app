-- Preorders from docs/Preorder Tracker_all.csv.
-- One purchase order per sheet row.
-- Source Cost is the bottle price. Delivery Fee is shipping.
-- Amount Paid is the deposit (blank or 0 means nothing paid yet).
-- "Added to Stock" is received into perfume liquid. "Waiting" stays ordered.
-- Depends on perfume names from 20260920120000_seed_stock_list_catalog.sql.
-- Safe to run again: rows are keyed by [preorder-tracker:NN] and stock is posted once.

INSERT INTO brands (name)
VALUES
  ('Armani'),
  ('Burberry'),
  ('CH'),
  ('CK'),
  ('D&G'),
  ('Dior'),
  ('Issey Miyake'),
  ('Jimmy Choo'),
  ('Juicy Couture'),
  ('Julitte'),
  ('Lancome'),
  ('MontBlanc'),
  ('Prada'),
  ('SI'),
  ('Valentino'),
  ('Versace'),
  ('YSL')
ON CONFLICT (name) DO NOTHING;

INSERT INTO perfumes (brand_id, name, product_type, default_bottle_size_ml, notes)
SELECT b.id, v.scent, v.product_type::product_type, v.bottle_ml, v.notes
FROM (
  VALUES
    ('CH', 'CH Good Girl Jasmine Abs. (W)', 'OTHER', 100::numeric, NULL),
    ('CK', 'CK Reflection', 'OTHER', 100, NULL),
    ('SI', 'SI Intense Refill', 'OTHER', 100, NULL),
    ('D&G', 'D&G L''Imperatrice EDT (W)', 'EDT', 100, NULL),
    ('Julitte', 'Julitte has a gun (Tester)', 'OTHER', 100, NULL),
    ('Burberry', 'Burberry Her EDP', 'EDP', 100, NULL),
    ('Issey Miyake', 'Issey Miyake Vetiver', 'OTHER', 100, 'From preorder tracker. Bottle size was not on the sheet; set to 100ml.'),
    ('Versace', 'Versace Eros (Tester)', 'OTHER', 100, 'From preorder tracker. Not Eros Flame. Bottle size was not on the sheet; set to 100ml.'),
    ('Versace', 'Versace Bright Crystal Parfum', 'OTHER', 90, NULL),
    ('Dior', 'Miss Dior Blomming', 'OTHER', 30, NULL),
    ('Versace', 'Versace Eros Flame', 'OTHER', 100, NULL),
    ('Valentino', 'Valentino BIR coral fantasy', 'OTHER', 100, NULL),
    ('Valentino', 'Valentino Born In Roma', 'OTHER', 100, NULL),
    ('D&G', 'D&G Light Blue Men', 'OTHER', 100, NULL),
    ('YSL', 'YSL MySelf', 'OTHER', 100, 'From preorder tracker. Bottle size was not on the sheet; set to 100ml.'),
    ('YSL', 'YSL Lire Refill', 'OTHER', 100, NULL),
    ('YSL', 'YSL Libre Berry Crush', 'OTHER', 90, NULL),
    ('Versace', 'Versace Bright Crystal Absolu', 'OTHER', 90, NULL),
    ('Juicy Couture', 'Viva La Juicy Noir (Tester)', 'OTHER', 100, 'Sheet name: Viva la juicy Noir tester. Bottle size was not on the sheet; set to 100ml.'),
    ('Juicy Couture', 'Viva La Juicy Gold (Tester)', 'OTHER', 100, 'Sheet name: Viva la juciy gold tester. Bottle size was not on the sheet; set to 100ml.'),
    ('MontBlanc', 'MontBlanc Explorer', 'OTHER', 200, NULL),
    ('Versace', 'Versace Crystal Emerlad', 'OTHER', 90, NULL),
    ('Lancome', 'Idole Refill', 'EDP', 100, 'From preorder tracker. Separate from Idole EDP. Bottle size was not on the sheet; set to 100ml.'),
    ('Armani', 'My Way', 'OTHER', 100, 'From preorder tracker. Bottle size was not on the sheet; set to 100ml.'),
    ('Prada', 'Prada Paradoxe', 'OTHER', 100, NULL),
    ('Jimmy Choo', 'Jimmy Choo I want Choo', 'OTHER', 100, NULL),
    ('Armani', 'Power of You', 'OTHER', 100, 'From preorder tracker. Bottle size was not on the sheet; set to 100ml.')
) AS v(brand, scent, product_type, bottle_ml, notes)
JOIN brands b ON b.name = v.brand
ON CONFLICT (brand_id, name) DO NOTHING;

INSERT INTO suppliers (name)
VALUES
  ('Kyaw''s Ko Perfume'),
  ('Perfume Source'),
  ('21 Question')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  r record;
  v_supplier_id uuid;
  v_perfume_id uuid;
  v_po_id uuid;
  v_poi_id uuid;
  v_key text;
  v_notes text;
  v_subtotal numeric;
  v_total numeric;
  v_qty_ml numeric;
  v_line_cost numeric;
  v_unit_per_ml numeric;
  v_item_id uuid;
  v_receipt_id uuid;
BEGIN
  FOR r IN
    SELECT *
    FROM (
      VALUES
        (1, 'Kyaw''s Ko Perfume', 'CH', 'CH Good Girl Jasmine Abs. (W)', 100::numeric, 1::numeric, 389000::numeric, 4000::numeric, 389000::numeric, DATE '2026-04-03', DATE '2026-05-15', 'received', 'Paid', 'CH Good Girl Jasmine Abs. 100ml'),
        (2, 'Kyaw''s Ko Perfume', 'CK', 'CK Reflection', 100, 2, 139000, 2000, 0, DATE '2026-04-12', DATE '2026-05-15', 'received', 'Paid; amount paid cell was blank', 'CK Reflection'),
        (3, 'Perfume Source', 'SI', 'SI Intense Refill', 100, 1, 198000, 4000, 50000, DATE '2026-04-12', DATE '2026-05-15', 'received', 'Paid', 'SI Intense'),
        (4, 'Perfume Source', 'D&G', 'D&G L''Imperatrice EDT (W)', 100, 1, 217000, 4000, 100000, DATE '2026-04-22', DATE '2026-05-15', 'received', 'Paid', 'D&G Limpertrice'),
        (5, 'Perfume Source', 'Julitte', 'Julitte has a gun (Tester)', 100, 1, 288000, 4000, 188000, DATE '2026-04-09', DATE '2026-05-26', 'received', 'Paid', 'Julitte has a gun Tester (100ml)'),
        (6, 'Kyaw''s Ko Perfume', 'Burberry', 'Burberry Her EDP', 100, 1, 379000, 2000, 0, DATE '2026-04-30', DATE '2026-05-15', 'received', 'Paid; amount paid cell was blank', 'Burberry Her'),
        (7, 'Kyaw''s Ko Perfume', 'Issey Miyake', 'Issey Miyake Vetiver', 100, 2, 199000, 2000, 0, DATE '2026-04-30', DATE '2026-05-15', 'ordered', 'Paid', 'Issey Miyake vetiver'),
        (8, 'Kyaw''s Ko Perfume', 'Versace', 'Versace Eros (Tester)', 100, 1, 249000, 0, 0, DATE '2026-05-06', DATE '2026-06-06', 'ordered', 'Paid', 'Versace Eros (Tester)'),
        (9, 'Perfume Source', 'Versace', 'Versace Bright Crystal Parfum', 90, 1, 298000, 4000, 100000, DATE '2026-05-06', DATE '2026-06-16', 'received', 'Paid', 'Versace Bright Crystal Parfum'),
        (10, 'Perfume Source', 'Dior', 'Miss Dior Blomming', 30, 1, 209000, 4000, 100000, DATE '2026-05-06', DATE '2026-06-05', 'received', 'Paid', 'Miss Dior Bloming Bouquet'),
        (11, 'Kyaw''s Ko Perfume', 'Versace', 'Versace Eros Flame', 100, 1, 249000, 2000, 0, DATE '2026-05-18', DATE '2026-06-18', 'ordered', 'Paid', 'Versace Flame (Tester)'),
        (12, 'Kyaw''s Ko Perfume', 'Valentino', 'Valentino BIR coral fantasy', 100, 1, 428000, 0, 0, DATE '2026-05-21', DATE '2026-06-21', 'ordered', 'Paid; amount paid cell was blank', 'Valentino Born in Roma Coral Fantasy EDP'),
        (13, 'Kyaw''s Ko Perfume', 'Valentino', 'Valentino Born In Roma', 100, 1, 438000, 0, 0, DATE '2026-05-23', DATE '2026-08-31', 'ordered', 'Pending', 'Valentino Born in Roma EDP'),
        (14, 'Perfume Source', 'D&G', 'D&G Light Blue Men', 100, 1, 205000, 0, 100000, DATE '2026-05-25', DATE '2026-08-31', 'ordered', '30% Prepaid', 'D&G Light Blue Men'),
        (15, 'Kyaw''s Ko Perfume', 'YSL', 'YSL MySelf', 100, 1, 490000, 0, 0, DATE '2026-05-29', DATE '2026-08-31', 'ordered', 'Pending', 'YSL MySelf'),
        (16, 'Kyaw''s Ko Perfume', 'YSL', 'YSL Lire Refill', 100, 1, 424000, 0, 0, DATE '2026-06-05', DATE '2026-09-16', 'ordered', 'Pending', 'YSL Libre Refill'),
        (17, 'Perfume Source', 'YSL', 'YSL Libre Berry Crush', 90, 1, 588000, 0, 188000, DATE '2026-06-08', DATE '2026-07-08', 'ordered', 'Paid', 'YSL Libre Berry Crush'),
        (18, '21 Question', 'Versace', 'Versace Bright Crystal Absolu', 90, 1, 238000, 4000, 238000, DATE '2026-06-07', DATE '2026-06-10', 'received', 'Paid', 'Versace Bright Crystal Absolu'),
        (19, 'Kyaw''s Ko Perfume', 'Juicy Couture', 'Viva La Juicy Noir (Tester)', 100, 1, 199000, 0, 0, DATE '2026-06-20', DATE '2026-09-30', 'ordered', 'Pending', 'Viva la juicy Noir tester'),
        (20, 'Kyaw''s Ko Perfume', 'Juicy Couture', 'Viva La Juicy Gold (Tester)', 100, 1, 199000, 0, 0, DATE '2026-06-20', DATE '2026-09-16', 'ordered', 'Pending', 'Viva la juciy gold tester'),
        (21, '21 Question', 'MontBlanc', 'MontBlanc Explorer', 200, 1, 365000, 4000, 0, DATE '2026-06-22', DATE '2026-07-22', 'received', 'Paid; amount paid cell was blank', 'Montblanc explorer edp'),
        (22, '21 Question', 'Versace', 'Versace Crystal Emerlad', 90, 1, 290000, 0, 0, DATE '2026-07-10', DATE '2026-08-15', 'ordered', 'Pending', 'Versace Emerlad'),
        (23, 'Perfume Source', 'Lancome', 'Idole Refill', 100, 1, 378000, 0, 178000, DATE '2026-07-12', DATE '2026-08-20', 'ordered', '30% Prepaid', 'Lancome Idole Refill'),
        (24, 'Perfume Source', 'Dior', 'Miss Dior Blomming', 50, 1, 239000, 0, 100000, DATE '2026-07-24', DATE '2026-08-24', 'ordered', '30% Prepaid', 'Miss Dior Blomming Boquet'),
        (25, 'Kyaw''s Ko Perfume', 'Armani', 'My Way', 100, 1, 380000, 0, 0, DATE '2026-07-15', DATE '2026-09-23', 'ordered', 'Pending', 'My Way'),
        (26, '21 Question', 'Prada', 'Prada Paradoxe', 100, 1, 415000, 0, 0, DATE '2026-08-02', DATE '2026-09-02', 'ordered', 'Pending', 'Prada Paradoxe edp refill'),
        (27, 'Perfume Source', 'Jimmy Choo', 'Jimmy Choo I want Choo', 100, 1, 255000, 4000, 100000, DATE '2026-08-08', DATE '2026-09-08', 'ordered', '30% Prepaid', 'Jimmy Cho I want Cho'),
        (28, 'Perfume Source', 'Armani', 'Power of You', 100, 1, 418000, 0, 118000, DATE '2026-07-06', DATE '2026-08-15', 'ordered', '30% Prepaid', 'Power of you')
    ) AS t(
      row_no,
      supplier,
      brand,
      scent,
      bottle_ml,
      qty,
      unit_cost,
      delivery,
      paid,
      order_date,
      arrival,
      stock_status,
      payment,
      sheet_name
    )
  LOOP
    v_key := '[preorder-tracker:' || lpad(r.row_no::text, 2, '0') || ']';
    v_notes := v_key || ' Payment: ' || r.payment || '. Sheet item: ' || r.sheet_name;
    v_subtotal := round(r.unit_cost * r.qty, 2);
    v_total := v_subtotal + COALESCE(r.delivery, 0);

    SELECT id INTO v_supplier_id FROM suppliers WHERE name = r.supplier;
    IF v_supplier_id IS NULL THEN
      RAISE EXCEPTION 'Supplier not found: %', r.supplier;
    END IF;

    SELECT p.id INTO v_perfume_id
    FROM perfumes p
    JOIN brands b ON b.id = p.brand_id
    WHERE b.name = r.brand AND p.name = r.scent;
    IF v_perfume_id IS NULL THEN
      RAISE EXCEPTION 'Perfume not found: % / %', r.brand, r.scent;
    END IF;

    SELECT id INTO v_po_id
    FROM purchase_orders
    WHERE notes LIKE v_key || '%'
    LIMIT 1;

    IF v_po_id IS NULL THEN
      INSERT INTO purchase_orders (
        po_number,
        supplier_id,
        order_date,
        expected_arrival_date,
        currency,
        exchange_rate,
        shipping_cost_original,
        shipping_cost_mmk,
        subtotal_original,
        subtotal_mmk,
        total_original,
        total_mmk,
        deposit_paid_mmk,
        status,
        notes
      ) VALUES (
        next_doc_number('purchase_order'),
        v_supplier_id,
        r.order_date,
        r.arrival,
        'MMK',
        1,
        COALESCE(r.delivery, 0),
        COALESCE(r.delivery, 0),
        v_subtotal,
        v_subtotal,
        v_total,
        v_total,
        COALESCE(r.paid, 0),
        'ordered',
        v_notes
      )
      RETURNING id INTO v_po_id;

      INSERT INTO purchase_order_items (
        purchase_order_id,
        perfume_id,
        bottle_size_ml,
        quantity,
        unit_cost_original,
        unit_cost_mmk,
        line_total_original,
        line_total_mmk,
        notes
      ) VALUES (
        v_po_id,
        v_perfume_id,
        r.bottle_ml,
        r.qty,
        r.unit_cost,
        r.unit_cost,
        v_subtotal,
        v_subtotal,
        r.sheet_name
      )
      RETURNING id INTO v_poi_id;
    ELSE
      UPDATE purchase_orders
      SET
        supplier_id = v_supplier_id,
        order_date = r.order_date,
        expected_arrival_date = r.arrival,
        shipping_cost_original = COALESCE(r.delivery, 0),
        shipping_cost_mmk = COALESCE(r.delivery, 0),
        subtotal_original = v_subtotal,
        subtotal_mmk = v_subtotal,
        total_original = v_total,
        total_mmk = v_total,
        deposit_paid_mmk = COALESCE(r.paid, 0),
        notes = v_notes
      WHERE id = v_po_id;

      SELECT id INTO v_poi_id
      FROM purchase_order_items
      WHERE purchase_order_id = v_po_id
      ORDER BY created_at
      LIMIT 1;

      IF v_poi_id IS NULL THEN
        RAISE EXCEPTION 'Purchase order % has no line', v_key;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM purchase_receipts WHERE purchase_order_id = v_po_id
      ) THEN
        UPDATE purchase_order_items
        SET
          perfume_id = v_perfume_id,
          bottle_size_ml = r.bottle_ml,
          quantity = r.qty,
          unit_cost_original = r.unit_cost,
          unit_cost_mmk = r.unit_cost,
          line_total_original = v_subtotal,
          line_total_mmk = v_subtotal,
          notes = r.sheet_name
        WHERE id = v_poi_id;
      END IF;
    END IF;

    IF r.stock_status = 'received' AND NOT EXISTS (
      SELECT 1 FROM purchase_receipts WHERE purchase_order_id = v_po_id
    ) THEN
      v_qty_ml := r.qty * r.bottle_ml;
      v_line_cost := v_total;
      v_unit_per_ml := CASE WHEN v_qty_ml = 0 THEN 0 ELSE round(v_line_cost / v_qty_ml, 6) END;

      INSERT INTO purchase_receipts (
        receipt_number,
        purchase_order_id,
        received_at,
        notes
      ) VALUES (
        next_doc_number('receipt'),
        v_po_id,
        r.arrival::timestamptz,
        v_key || ' Added to stock from preorder tracker'
      )
      RETURNING id INTO v_receipt_id;

      INSERT INTO purchase_receipt_items (
        purchase_receipt_id,
        purchase_order_item_id,
        perfume_id,
        quantity_bottles,
        bottle_size_ml,
        quantity_ml,
        unit_cost_mmk_per_ml,
        line_cost_mmk
      ) VALUES (
        v_receipt_id,
        v_poi_id,
        v_perfume_id,
        r.qty,
        r.bottle_ml,
        v_qty_ml,
        v_unit_per_ml,
        v_line_cost
      );

      UPDATE purchase_order_items
      SET received_quantity = r.qty
      WHERE id = v_poi_id;

      v_item_id := get_or_create_perfume_liquid_item(v_perfume_id);
      PERFORM apply_inbound_wac(v_item_id, v_qty_ml, v_unit_per_ml);

      INSERT INTO inventory_movements (
        inventory_item_id,
        moved_at,
        movement_type,
        quantity,
        unit,
        unit_cost_mmk,
        total_cost_mmk,
        purchase_receipt_id,
        notes
      ) VALUES (
        v_item_id,
        r.arrival::timestamptz,
        'PURCHASE_RECEIPT',
        v_qty_ml,
        'ml',
        v_unit_per_ml,
        v_line_cost,
        v_receipt_id,
        'Receive ' || trim(to_char(r.qty, 'FM999990.##')) || ' × ' || trim(to_char(r.bottle_ml, 'FM999990.##')) || 'ml'
      );

      UPDATE purchase_orders
      SET status = 'received'
      WHERE id = v_po_id;
    ELSIF r.stock_status = 'ordered' THEN
      UPDATE purchase_orders
      SET status = 'ordered'
      WHERE id = v_po_id
        AND status = 'draft';
    END IF;
  END LOOP;
END;
$$;
