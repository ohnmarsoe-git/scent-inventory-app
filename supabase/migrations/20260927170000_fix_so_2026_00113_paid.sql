-- SO-2026-00113: paid total should be MMK 266,000 (was 379,500).

DO $$
DECLARE
  v_sale_id uuid;
  v_target numeric := 266000;
  v_paid numeric;
  v_cut numeric;
  v_payment payments%ROWTYPE;
BEGIN
  SELECT id INTO v_sale_id
  FROM sales
  WHERE sale_number = 'SO-2026-00113';

  IF v_sale_id IS NULL THEN
    RAISE NOTICE 'SO-2026-00113 not found; skipping';
    RETURN;
  END IF;

  SELECT COALESCE(round(sum(amount_mmk), 2), 0)
  INTO v_paid
  FROM payments
  WHERE sale_id = v_sale_id;

  IF v_paid = 0 THEN
    UPDATE sales
    SET paid_amount_mmk = v_target
    WHERE id = v_sale_id;

    INSERT INTO payments (
      payment_number,
      sale_id,
      customer_id,
      payment_date,
      amount_mmk,
      payment_method,
      notes
    )
    SELECT
      next_doc_number('payment'),
      s.id,
      s.customer_id,
      s.sale_date,
      v_target,
      'cash'::payment_method,
      'Corrected paid total to MMK 266,000'
    FROM sales s
    WHERE s.id = v_sale_id;

    PERFORM refresh_sale_payment_status(v_sale_id);
    RETURN;
  END IF;

  IF v_paid < v_target THEN
    RAISE EXCEPTION
      'SO-2026-00113 paid is % which is less than target %; not auto-increasing',
      v_paid, v_target;
  END IF;

  v_cut := round(v_paid - v_target, 2);

  FOR v_payment IN
    SELECT * FROM payments
    WHERE sale_id = v_sale_id
    ORDER BY created_at DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_cut <= 0;
    IF v_payment.amount_mmk <= v_cut THEN
      v_cut := round(v_cut - v_payment.amount_mmk, 2);
      DELETE FROM payments WHERE id = v_payment.id;
    ELSE
      UPDATE payments
      SET amount_mmk = round(v_payment.amount_mmk - v_cut, 2)
      WHERE id = v_payment.id;
      v_cut := 0;
    END IF;
  END LOOP;

  UPDATE sales
  SET paid_amount_mmk = (
    SELECT COALESCE(round(sum(amount_mmk), 2), 0)
    FROM payments
    WHERE sale_id = v_sale_id
  )
  WHERE id = v_sale_id;

  PERFORM refresh_sale_payment_status(v_sale_id);
END;
$$;
