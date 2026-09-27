-- A payment cannot exceed what is still owed. Existing overpayments are
-- reduced to the sale total, newest payment first.

CREATE OR REPLACE FUNCTION record_sale_payment(
  p_sale_id uuid,
  p_amount_mmk numeric,
  p_payment_method payment_method,
  p_payment_date date,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sale sales%ROWTYPE;
  v_payment_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount_mmk IS NULL OR p_amount_mmk <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF v_sale.is_voided THEN
    RAISE EXCEPTION 'Cannot pay a voided sale';
  END IF;
  IF p_amount_mmk > v_sale.remaining_amount_mmk THEN
    RAISE EXCEPTION 'Payment cannot be more than the amount still owed';
  END IF;

  INSERT INTO payments (
    payment_number,
    sale_id,
    customer_id,
    payment_date,
    amount_mmk,
    payment_method,
    notes,
    created_by
  ) VALUES (
    next_doc_number('payment'),
    p_sale_id,
    v_sale.customer_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    p_amount_mmk,
    COALESCE(p_payment_method, 'cash'),
    p_notes,
    v_uid
  )
  RETURNING id INTO v_payment_id;

  UPDATE sales
  SET paid_amount_mmk = paid_amount_mmk + p_amount_mmk
  WHERE id = p_sale_id;

  PERFORM refresh_sale_payment_status(p_sale_id);

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION record_sale_payment(uuid, numeric, payment_method, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_sale_payment(uuid, numeric, payment_method, date, text) TO authenticated;

DO $$
DECLARE
  v_sale sales%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_left numeric;
BEGIN
  FOR v_sale IN
    SELECT * FROM sales
    WHERE paid_amount_mmk > total_mmk
    FOR UPDATE
  LOOP
    v_left := round(v_sale.paid_amount_mmk - v_sale.total_mmk, 2);
    FOR v_payment IN
      SELECT * FROM payments
      WHERE sale_id = v_sale.id
      ORDER BY created_at DESC
      FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      IF v_payment.amount_mmk <= v_left THEN
        v_left := round(v_left - v_payment.amount_mmk, 2);
        DELETE FROM payments WHERE id = v_payment.id;
      ELSE
        UPDATE payments
        SET amount_mmk = round(v_payment.amount_mmk - v_left, 2)
        WHERE id = v_payment.id;
        v_left := 0;
      END IF;
    END LOOP;

    UPDATE sales
    SET
      paid_amount_mmk = (
        SELECT COALESCE(round(sum(amount_mmk), 2), 0)
        FROM payments
        WHERE sale_id = v_sale.id
      )
    WHERE id = v_sale.id;

    PERFORM refresh_sale_payment_status(v_sale.id);
  END LOOP;
END;
$$;
