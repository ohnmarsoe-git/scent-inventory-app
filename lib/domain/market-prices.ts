/** Market sell prices from Pricing Strategy II (column M).
 * First row wins for each scent + size, matching Price list II.
 * Sizes: 3, 5, 10, 20, 30ml. "10ml (thick)" is not the 10ml list price.
 */
export const MARKET_SCENTS: {
  name: string;
  prices: Partial<Record<3 | 5 | 10 | 20 | 30, number>>;
}[] = [
  { name: "Armaf CDN EDP (W)", prices: { 3: 10000, 5: 14000, 10: 22000, 30: 72000 } },
  { name: "Armaf CDN Untold (U)", prices: { 3: 11000, 5: 15000, 10: 25000, 20: 53000, 30: 78500 } },
  { name: "CK In 2U EDT (w)", prices: { 3: 8000, 5: 14000, 10: 22000, 30: 60000 } },
  { name: "JLO Still EDP (W)", prices: { 3: 11000, 5: 13000, 10: 24000, 30: 70000 } },
  { name: "D&G Light Blue EDT", prices: { 3: 13000, 5: 23500, 10: 37000, 20: 73000, 30: 100000 } },
  { name: "D&G L'Imperatrice EDT (W)", prices: { 3: 15000, 5: 20000, 10: 37000, 20: 68000, 30: 97000 } },
  { name: "VS Bombshell", prices: { 3: 18000, 5: 27000, 10: 49000, 20: 95000, 30: 140000 } },
  { name: "CK Reflection (U)", prices: { 3: 15000, 5: 20000, 10: 24000, 20: 45000, 30: 65000 } },
  { name: "Gucci Floral gorgeous gardenia", prices: { 3: 17000, 5: 28000, 10: 51500, 20: 90000, 30: 145000 } },
  { name: "Replica beach Walk", prices: { 3: 16500, 5: 25000, 10: 45000, 20: 90000, 30: 135000 } },
  { name: "SI Intense Refill (W)", prices: { 3: 13000, 5: 20000, 10: 35000, 20: 62000, 30: 89500 } },
  { name: "Burberry Her EDP", prices: { 3: 19000, 5: 29000, 10: 53000, 20: 105000, 30: 155000 } },
  { name: "Lacome IDOLE (W)", prices: { 3: 22000, 5: 34000, 10: 63000, 20: 125000, 30: 188500 } },
  { name: "Julitte has a gun Not a perfume", prices: { 3: 17000, 5: 26000, 10: 47000, 20: 92000, 30: 135000 } },
  { name: "JLO Still EDP Batch-02 (W)", prices: { 3: 10000, 5: 15000, 10: 25000, 20: 49000, 30: 75000 } },
  { name: "CH Good Girl Jasmine Abs. (W)", prices: { 3: 23500, 5: 38000, 10: 69000, 20: 130000, 30: 195000 } },
  { name: "D&G L'Imperatrice EDT Batch-02 (W)", prices: { 3: 12000, 5: 21000, 10: 35000, 20: 69500, 30: 102000 } },
  { name: "Versace Birght Crystal absolu (W)", prices: { 3: 14000, 5: 24000, 10: 40000, 20: 75000, 30: 110000 } },
  { name: "Versace Birght Crystal Parfum (W)", prices: { 3: 16500, 5: 28000, 10: 48900, 20: 90000, 30: 130500 } },
  { name: "Versace Eros Energy (M)", prices: { 3: 15000, 5: 22500, 10: 40000, 20: 75000, 30: 115000 } },
  { name: "Versace Eors Flame (M)", prices: { 3: 15000, 5: 22500, 10: 40000, 20: 75000, 30: 115000 } },
  { name: "Valentino Born in Roma Coral Fantasy", prices: { 3: 21500, 5: 36000, 10: 67000, 20: 126500, 30: 186500 } },
  { name: "Valentino Born in Roma EDP", prices: { 3: 22000, 5: 36500, 10: 68000, 20: 129000, 30: 189500 } },
  { name: "YSL MySelf Refill", prices: { 3: 18500, 5: 31000, 10: 56000, 20: 103000, 30: 153000 } },
  { name: "Montblanc explorer edp", prices: { 3: 12000, 5: 18000, 10: 31500, 20: 59000, 30: 86500 } },
  { name: "Issey Miyake Leau DIssey", prices: { 3: 12000, 5: 19000, 10: 32500, 20: 61500, 30: 90500 } },
  { name: "Miss Dior Blomming Boquet", prices: { 3: 32000, 5: 45000, 10: 85000 } },
  { name: "YSL Libre Berry Crush", prices: { 3: 30500, 5: 50900, 10: 96500, 20: 184500, 30: 275000 } },
  { name: "Versace Emerald", prices: { 3: 18000, 5: 28500, 10: 52000, 20: 98500, 30: 145500 } },
  { name: "D&G LightBlue (M)", prices: { 3: 13000, 5: 20500, 10: 39000, 20: 73500, 30: 108000 } },
  { name: "Estée Lauder Pleasure", prices: { 3: 17500, 5: 28000, 10: 49000, 30: 130000 } },
  { name: "Jimmy Cho I Want Cho", prices: { 3: 15000, 5: 24000, 10: 35000, 20: 66500, 30: 95500 } },
  { name: "YSL Libre Refill", prices: { 3: 22500, 5: 36000, 10: 65000, 20: 127000, 30: 189000 } },
  { name: "Prada Paradoxe Refill", prices: { 3: 22000, 5: 35500, 10: 64000, 20: 125000, 30: 184900 } },
];
