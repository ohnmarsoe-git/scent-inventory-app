-- PO-2026-00011 (Versace Flame tester): shipping was left blank on the tracker.
-- Currency is MMK, so original and MMK shipping are both 2,000.
-- Total is rebuilt from subtotal + shipping + other costs.

UPDATE purchase_orders
SET
  shipping_cost_original = 2000,
  shipping_cost_mmk = 2000,
  total_original = subtotal_original + 2000 + other_cost_original,
  total_mmk = subtotal_mmk + 2000 + other_cost_mmk
WHERE po_number = 'PO-2026-00011';
