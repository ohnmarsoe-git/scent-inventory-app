-- Price list: market sell prices by perfume + decant size (from Pricing Strategy / Price list II)

CREATE TABLE IF NOT EXISTS price_list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfume_id uuid NOT NULL REFERENCES perfumes (id) ON DELETE CASCADE,
  size_ml numeric(12, 2) NOT NULL CHECK (size_ml > 0),
  sell_price_mmk numeric(14, 2) NOT NULL CHECK (sell_price_mmk >= 0),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_list_perfume_size_unique UNIQUE (perfume_id, size_ml)
);

CREATE INDEX IF NOT EXISTS price_list_entries_perfume_id_idx
  ON price_list_entries (perfume_id);

CREATE TRIGGER price_list_entries_set_updated_at
  BEFORE UPDATE ON price_list_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE price_list_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_all_price_list_entries ON price_list_entries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Optional default list price on stock rows (synced when set from price list / sale UI)
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS list_price_mmk numeric(14, 2)
  CHECK (list_price_mmk IS NULL OR list_price_mmk >= 0);

COMMENT ON TABLE price_list_entries IS
  'Market sell prices by perfume and decant size (Price list II style).';

COMMENT ON COLUMN inventory_items.list_price_mmk IS
  'Suggested unit sale price for this SKU; sale form auto-fills, can override.';
