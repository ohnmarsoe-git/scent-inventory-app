-- Deposit already paid on a purchase order (pre-order).
-- Balance due = total_mmk - deposit_paid_mmk.
-- Paid money on an order that has not arrived is cash tied up in stock, not an expense.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS deposit_paid_mmk numeric(14, 2) NOT NULL DEFAULT 0
  CHECK (deposit_paid_mmk >= 0);

COMMENT ON COLUMN purchase_orders.deposit_paid_mmk IS
  'MMK already paid to the supplier (nothing, 30%, half, or full). Not an expense until received; it is cash invested in stock still on the way.';
