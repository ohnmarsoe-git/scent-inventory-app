-- Catalog from docs/Stock List_all.csv: scent name, brand, bottle size.
-- Decant prices, source cost, status, and stock qty are not master data.
-- Brand fixes: "Victoria'a Secret" -> Victoria's Secret, "JiLo" -> JLo,
-- "YSL libre" -> YSL (Libre is the scent, not a separate brand).

INSERT INTO brands (name)
VALUES
  ('Armaf'),
  ('Burberry'),
  ('CH'),
  ('CK'),
  ('D&G'),
  ('Dior'),
  ('Gucci'),
  ('Issey Miyake'),
  ('Jimmy Choo'),
  ('JLo'),
  ('Julitte'),
  ('Lancome'),
  ('MontBlanc'),
  ('Nautica'),
  ('Prada'),
  ('Replica'),
  ('SI'),
  ('Valentino'),
  ('Versace'),
  ('Victoria''s Secret'),
  ('YSL')
ON CONFLICT (name) DO NOTHING;

INSERT INTO perfumes (brand_id, name, product_type, default_bottle_size_ml, notes)
SELECT
  b.id,
  v.scent,
  v.product_type::product_type,
  v.bottle_ml,
  v.notes
FROM (
  VALUES
    ('Armaf', 'Armaf CDN EDP (W)', 'EDP', 105::numeric, 'Gender: Women'),
    ('Armaf', 'Armaf CDN Untold (U)', 'OTHER', 105, 'Gender: Unisex'),
    ('CK', 'CK In 2U For Her EDT (W)', 'EDT', 100, 'Gender: Women'),
    ('JLo', 'JLO Still EDP Batch 1 (W)', 'EDP', 100, 'Gender: Women. Spreadsheet brand: JiLo'),
    ('Nautica', 'Nautica Voyage Sport (M)', 'OTHER', 100, 'Gender: Men'),
    ('D&G', 'D&G Light Blue EDT (W)', 'EDT', 100, 'Gender: Men (sheet). Scent name is marked (W)'),
    ('D&G', 'D&G L''Imperatrice EDT (W)', 'EDT', 100, 'Gender: Women'),
    ('Victoria''s Secret', 'VS Bombshell EDP (W)', 'EDP', 100, 'Gender: Women. Spreadsheet brand: Victoria''a Secret'),
    ('CH', 'CH Good Girl Jasmine Abs. (W)', 'OTHER', 100, 'Gender: Women'),
    ('Gucci', 'Gucci Floral gorgeous gardenia', 'OTHER', 100, 'Gender: Women'),
    ('JLo', 'JLO Still EDP Batch-2 (W)', 'EDP', 100, 'Gender: Women. Spreadsheet brand: JiLo'),
    ('Replica', 'Replica beach Walk', 'OTHER', 100, 'Gender: Unisex'),
    ('CK', 'CK Reflection', 'OTHER', 100, 'Gender: Men'),
    ('SI', 'SI Intense Refill', 'OTHER', 100, 'Gender: Women'),
    ('Julitte', 'Julitte has a gun (Tester)', 'OTHER', 100, 'Gender: Unisex'),
    ('Dior', 'Miss Dior Blomming', 'OTHER', 30, 'Gender: Women'),
    ('Lancome', 'Idole EDP', 'EDP', 100, 'Gender: Women'),
    ('Burberry', 'Burberry Her EDP', 'EDP', 100, 'Gender: Women'),
    ('Versace', 'Versace Bright Crystal Absolu', 'OTHER', 90, 'Gender: Women'),
    ('Versace', 'Versace Bright Crystal Parfum', 'OTHER', 90, 'Gender: Women'),
    ('D&G', 'D&G Light Blue Men', 'OTHER', 100, 'Gender: Men'),
    ('YSL', 'YSL Libre Berry Crush', 'OTHER', 90, 'Gender: Women. Spreadsheet brand: YSL libre'),
    ('MontBlanc', 'MontBlanc Explorer', 'OTHER', 200, 'Gender: Men'),
    ('Burberry', 'Burberry Sheer', 'OTHER', 100, 'Gender: Women'),
    ('Versace', 'Versace Eros Flame', 'OTHER', 100, 'Gender: Men'),
    ('Versace', 'Versace Eros Energy', 'OTHER', 100, 'Gender: Men'),
    ('Issey Miyake', 'Issey Miyake L''Eau D''ISSEY Pour Homme', 'OTHER', 100, 'Gender: Men'),
    ('Valentino', 'Valentino Born In Roma', 'OTHER', 100, 'Gender: Women'),
    ('Valentino', 'Valentino BIR coral fantasy', 'OTHER', 100, 'Gender: Women'),
    ('YSL', 'YSL Lire Refill', 'OTHER', 100, 'Gender: Women'),
    ('Prada', 'Prada Paradoxe', 'OTHER', 100, 'Gender: Women'),
    ('Versace', 'Versace Crystal Emerlad', 'OTHER', 90, 'Gender: Women'),
    ('Jimmy Choo', 'Jimmy Choo I want Choo', 'OTHER', 100, 'Gender: Women')
) AS v(brand, scent, product_type, bottle_ml, notes)
JOIN brands b ON b.name = v.brand
ON CONFLICT (brand_id, name) DO UPDATE
SET
  product_type = EXCLUDED.product_type,
  default_bottle_size_ml = EXCLUDED.default_bottle_size_ml,
  notes = CASE
    WHEN perfumes.notes IS NULL OR btrim(perfumes.notes) = '' THEN EXCLUDED.notes
    ELSE perfumes.notes
  END,
  is_active = true,
  updated_at = now();
