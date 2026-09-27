-- One-time clear of test business data.
-- Keeps your login (profiles), app settings, and the default expense categories.
-- Run in the Supabase SQL Editor. Do not add this file to the migrations folder.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'payments',
    'sale_items',
    'sales',
    'expenses',
    'decant_consumable_usages',
    'decant_items',
    'decant_transactions',
    'inventory_movements',
    'inventory_items',
    'purchase_receipt_items',
    'purchase_receipts',
    'purchase_order_items',
    'purchase_orders',
    'price_list_entries',
    'consumables',
    'perfumes',
    'customers',
    'suppliers',
    'brands'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;

  IF to_regclass('public.doc_counters') IS NOT NULL THEN
    UPDATE public.doc_counters SET last_value = 0;
  END IF;
END $$;
