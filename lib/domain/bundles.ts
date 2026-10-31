import { marginRate, quoteCogs } from "./pricing";

/** Common decant sizes offered when defining a bundle set. */
export const BUNDLE_SIZES = [2, 3, 5, 10] as const;

/**
 * Split a bundle sale price across included lines.
 * Uses positive weights when available (e.g. market prices); otherwise even split.
 * Remainder goes on the last line so the sum always equals totalMmk.
 */
export function allocateBundleUnitPrices(
  totalMmk: number,
  weights: number[],
): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const total = Math.max(0, Math.round(Number(totalMmk) || 0));
  const safe = weights.map((w) => {
    const num = Number(w);
    return Number.isFinite(num) && num > 0 ? num : 0;
  });
  const weightSum = safe.reduce((sum, w) => sum + w, 0);
  const use = weightSum > 0 ? safe : weights.map(() => 1);
  const denom = use.reduce((sum, w) => sum + w, 0);

  const prices = use.map((w) => Math.floor((total * w) / denom));
  const allocated = prices.reduce((sum, p) => sum + p, 0);
  prices[n - 1] = (prices[n - 1] ?? 0) + (total - allocated);
  return prices;
}

export type BundleQuoteItem = {
  quantity: number;
  costPerMl: number | null | undefined;
};

/**
 * Economics for one bundle set: total ml, sell/ml, estimated COGS, margin.
 * Packaging is per decant unit when provided (same rule as normal sales).
 */
export function quoteBundleSet(opts: {
  sizeMl: number;
  salePriceMmk: number;
  items: BundleQuoteItem[];
  packagingCostPerUnit?: number | null;
}) {
  const sizeMl = Math.max(0, Number(opts.sizeMl) || 0);
  const salePrice = Math.max(0, Number(opts.salePriceMmk) || 0);
  const pack =
    opts.packagingCostPerUnit != null &&
    Number.isFinite(opts.packagingCostPerUnit) &&
    opts.packagingCostPerUnit > 0
      ? opts.packagingCostPerUnit
      : 0;

  let units = 0;
  let knownUnits = 0;
  let cogs = 0;
  let missingCost = false;

  for (const item of opts.items) {
    const qty = Math.max(0, Math.trunc(Number(item.quantity) || 0));
    if (!(qty > 0)) continue;
    units += qty;
    const costPerMl = Number(item.costPerMl);
    if (!(costPerMl > 0) || !(sizeMl > 0)) {
      missingCost = true;
      continue;
    }
    knownUnits += qty;
    cogs += qty * quoteCogs(costPerMl, sizeMl, false, pack);
  }

  const totalMl = Math.round(units * sizeMl * 100) / 100;
  const pricePerMl = totalMl > 0 && salePrice > 0 ? salePrice / totalMl : null;
  const pricePerUnit = units > 0 && salePrice > 0 ? salePrice / units : null;
  const roundedCogs = Math.round(cogs * 100) / 100;
  const hasFullCost = units > 0 && knownUnits === units && !missingCost;

  return {
    units,
    totalMl,
    pricePerMl,
    pricePerUnit,
    cogs: hasFullCost ? roundedCogs : null,
    margin: hasFullCost ? marginRate(salePrice, roundedCogs) : null,
    profit:
      hasFullCost && salePrice > 0
        ? Math.round((salePrice - roundedCogs) * 100) / 100
        : null,
    hasFullCost,
  };
}
