-- SO-2026-00113: D&G L'Imperatrice EDT sale price should be MMK 200,000.

DO $$
DECLARE
  v_sale_id uuid;
  v_item_id uuid;
  v_qty numeric;
  v_discount numeric;
  v_cogs numeric;
  v_line_total numeric;
  v_subtotal numeric;
  v_header_discount numeric;
  v_total numeric;
  v_sale_cogs numeric;
BEGIN
  SELECT id INTO v_sale_id
  FROM sales
  WHERE sale_number = 'SO-2026-00113';

  IF v_sale_id IS NULL THEN
    RAISE NOTICE 'SO-2026-00113 not found; skipping';
    RETURN;
  END IF;

  SELECT
    si.id,
    si.quantity,
    si.line_discount_mmk,
    si.cogs_mmk
  INTO
    v_item_id,
    v_qty,
    v_discount,
    v_cogs
  FROM sale_items si
  LEFT JOIN perfumes p ON p.id = si.perfume_id
  WHERE si.sale_id = v_sale_id
    AND (
      si.description ILIKE '%Imperatrice%'
      OR p.name ILIKE '%Imperatrice%'
    )
  ORDER BY si.created_at
  LIMIT 1;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'SO-2026-00113 has no D&G L''Imperatrice line to update';
  END IF;

  v_line_total := round((200000 * v_qty) - COALESCE(v_discount, 0), 2);

  UPDATE sale_items
  SET
    unit_sale_price_mmk = 200000,
    line_total_mmk = v_line_total,
    profit_mmk = round(v_line_total - COALESCE(v_cogs, 0), 2)
  WHERE id = v_item_id;

  SELECT
    COALESCE(SUM(line_total_mmk), 0),
    COALESCE(SUM(cogs_mmk), 0)
  INTO v_subtotal, v_sale_cogs
  FROM sale_items
  WHERE sale_id = v_sale_id;

  SELECT discount_mmk INTO v_header_discount
  FROM sales
  WHERE id = v_sale_id;

  v_total := round(v_subtotal - COALESCE(v_header_discount, 0), 2);

  UPDATE sales
  SET
    subtotal_mmk = round(v_subtotal, 2),
    total_mmk = v_total,
    cogs_mmk = round(v_sale_cogs, 2),
    gross_profit_mmk = round(v_total - v_sale_cogs, 2)
  WHERE id = v_sale_id;

  PERFORM refresh_sale_payment_status(v_sale_id);
END;
$$;
