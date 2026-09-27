-- Price list margin cost the user sets, instead of adding every unsized consumable.
-- normal_bottle_mmk stays null until saved. After that, only those prices are used.
-- price_list_tool_ids is empty until the user ticks items (syringe, converter, …).

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS normal_bottle_mmk jsonb,
  ADD COLUMN IF NOT EXISTS price_list_tool_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN app_settings.normal_bottle_mmk IS
  'Normal bottle price in MMK by decant ml, e.g. {"3":1200,"10":1250}. Null until the user saves.';

COMMENT ON COLUMN app_settings.price_list_tool_ids IS
  'Consumables included in tools cost. Unticked items such as tester paper are not added.';
