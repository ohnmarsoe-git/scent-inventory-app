-- Phase 6: Expense create helper (uses next_doc_number)

CREATE OR REPLACE FUNCTION create_expense(
  p_expense_date date,
  p_category_id uuid,
  p_description text,
  p_amount_mmk numeric,
  p_payment_method payment_method,
  p_related_purchase_order_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount_mmk IS NULL OR p_amount_mmk <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM expense_categories WHERE id = p_category_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid expense category';
  END IF;

  INSERT INTO expenses (
    expense_number,
    expense_date,
    category_id,
    description,
    amount_mmk,
    payment_method,
    related_purchase_order_id,
    notes,
    created_by
  ) VALUES (
    next_doc_number('expense'),
    COALESCE(p_expense_date, CURRENT_DATE),
    p_category_id,
    trim(p_description),
    p_amount_mmk,
    COALESCE(p_payment_method, 'cash'),
    p_related_purchase_order_id,
    p_notes,
    v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id uuid,
  p_expense_date date,
  p_category_id uuid,
  p_description text,
  p_amount_mmk numeric,
  p_payment_method payment_method,
  p_related_purchase_order_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount_mmk IS NULL OR p_amount_mmk <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE expenses
  SET
    expense_date = COALESCE(p_expense_date, expense_date),
    category_id = p_category_id,
    description = trim(p_description),
    amount_mmk = p_amount_mmk,
    payment_method = COALESCE(p_payment_method, payment_method),
    related_purchase_order_id = p_related_purchase_order_id,
    notes = p_notes
  WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  RETURN p_expense_id;
END;
$$;

REVOKE ALL ON FUNCTION create_expense(date, uuid, text, numeric, payment_method, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_expense(uuid, date, uuid, text, numeric, payment_method, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_expense(date, uuid, text, numeric, payment_method, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_expense(uuid, date, uuid, text, numeric, payment_method, uuid, text) TO authenticated;
