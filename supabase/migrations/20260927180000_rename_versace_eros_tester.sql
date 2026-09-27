-- Preorder sheet said "Versace Eros (Tester)"; the bottle is Eros Energy.

UPDATE perfumes AS perfume
SET
  name = 'Versace Eros Energy (Tester)',
  notes = CASE
    WHEN perfume.notes IS NULL OR trim(perfume.notes) = ''
      THEN 'Renamed from Versace Eros (Tester); full name is Eros Energy.'
    WHEN perfume.notes ILIKE '%Eros Energy%'
      THEN perfume.notes
    ELSE perfume.notes || ' Renamed from Versace Eros (Tester); full name is Eros Energy.'
  END
FROM brands AS brand
WHERE perfume.brand_id = brand.id
  AND brand.name = 'Versace'
  AND perfume.name = 'Versace Eros (Tester)';
