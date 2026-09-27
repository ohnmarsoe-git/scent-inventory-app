import { MARKET_SCENTS } from "./market-prices";
import { FULL_BOTTLE_PRICES } from "./full-bottle-prices";

/** Decant sizes shown on the price list matrix (matches Price list II). */
export const PRICE_LIST_SIZES = [3, 5, 10, 20, 30] as const;

/** Sizes offered on a new sale. 10ml is the usual order. */
export const SALE_SIZES = [3, 5, 10, 20, 30] as const;

export type PriceListSize = (typeof PRICE_LIST_SIZES)[number];

export type PriceSource = "saved" | "market" | "cost" | "none";

/** Fallback when no list price: COGS × margin, rounded to nearest 500 MMK. */
export const DEFAULT_SALE_MARGIN = 0.25;

/**
 * Market sell ≈ slope × cost-per-ml + intercept, then nearest 500.
 * Fitted from Pricing Strategy II for scents that are not on that sheet.
 */
const MARKET_FIT: Record<PriceListSize, { slope: number; intercept: number }> = {
  3: { slope: 3.924, intercept: 4738 },
  5: { slope: 6.306, intercept: 7067 },
  10: { slope: 12.898, intercept: 7077 },
  20: { slope: 26.527, intercept: 9780 },
  30: { slope: 40.744, intercept: 8856 },
};

const PHRASES: Array<[RegExp, string]> = [
  [/\bd\s*&\s*g\b/g, "dolce gabbana"],
  [/\bd\s+and\s+g\b/g, "dolce gabbana"],
  [/\bvs\b/g, "victoria secret"],
  [/\bck\b/g, "calvin klein"],
  [/\bjlo\b/g, "jennifer lopez"],
  [/\bch\b/g, "carolina herrera"],
  [/\bcdn\b/g, "club de nuit"],
  [/\bdiro\b/g, "dior"],
  [/\bbirght\b/g, "bright"],
  [/\beors\b/g, "eros"],
  [/\bblomming\b/g, "blooming"],
  [/\bboquet\b/g, "bouquet"],
  [/\bjulitte\b/g, "juliette"],
  [/\blacome\b/g, "lancome"],
  [/\bl\s*eau\b/g, "leau"],
  [/\bd\s*issey\b/g, "dissey"],
];

const DROP = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "for",
  "de",
  "le",
  "la",
  "eau",
  "edp",
  "edt",
  "parfum",
  "toilette",
  "with",
]);

const KEEP_SHORT = new Set(["si", "2u"]);

type IndexedScent = (typeof MARKET_SCENTS)[number] & { tokens: string[] };

function fold(input: string) {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function scentTokens(input: string): string[] {
  let text = fold(input).replace(/['’.]/g, "").replace(/&/g, " and ");
  text = text
    .replace(/\(\s*w\s*\)/g, " women ")
    .replace(/\(\s*m\s*\)/g, " men ")
    .replace(/\(\s*u\s*\)/g, " unisex ");
  for (const [pattern, replacement] of PHRASES) {
    text = text.replace(pattern, replacement);
  }
  const tokens: string[] = [];
  for (const token of text.split(/[^a-z0-9]+/)) {
    if (!token || DROP.has(token) || /^\d+$/.test(token)) continue;
    if (token.length < 3 && !KEEP_SHORT.has(token)) continue;
    tokens.push(token);
  }
  return tokens;
}

const SCENT_INDEX: IndexedScent[] = MARKET_SCENTS.map((scent) => ({
  ...scent,
  tokens: scentTokens(scent.name),
}));

export function isPriceListSize(size: number): size is PriceListSize {
  return (PRICE_LIST_SIZES as readonly number[]).includes(size);
}

/** Best Pricing Strategy II scent for a perfume label (brand + name). */
export function matchMarketScent(label: string) {
  const query = scentTokens(label);
  if (!query.length) return null;
  const querySet = new Set(query);

  let best: { scent: IndexedScent; score: number; extra: number } | null = null;
  for (const scent of SCENT_INDEX) {
    const shared = scent.tokens.filter((token) => querySet.has(token));
    if (!shared.length) continue;
    const shorter = Math.min(querySet.size, scent.tokens.length);
    if (shared.length / shorter < 0.6) continue;
    if (shared.length < 2 && shorter > 1) continue;

    const extra =
      scent.tokens.length - shared.length + (querySet.size - shared.length);
    const score = shared.length * 10 - extra;
    if (!best || score > best.score || (score === best.score && extra < best.extra)) {
      best = { scent, score, extra };
    }
  }
  return best?.scent ?? null;
}

export function lookupMarketPrice(label: string, sizeMl: number): number | null {
  if (!isPriceListSize(sizeMl)) return null;
  const price = matchMarketScent(label)?.prices[sizeMl];
  return price && price > 0 ? price : null;
}

function marketPoints(label: string) {
  const scent = matchMarketScent(label);
  if (!scent) return [];
  return PRICE_LIST_SIZES.flatMap((size) => {
    const price = scent.prices[size];
    return price && price > 0 ? [{ size, price }] : [];
  });
}

/** Price a size that is not on the 3/5/10/20/30 list, from the sheet's neighbours. */
export function interpolateMarketPrice(label: string, sizeMl: number): number | null {
  const points = marketPoints(label);
  if (!points.length || !(sizeMl > 0)) return null;

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;

  if (sizeMl <= first.size) {
    return roundMarketPrice(first.price * (sizeMl / first.size));
  }
  if (sizeMl >= last.size) {
    return roundMarketPrice(last.price * (sizeMl / last.size));
  }

  for (let i = 0; i < points.length - 1; i++) {
    const left = points[i];
    const right = points[i + 1];
    if (!left || !right || sizeMl < left.size || sizeMl > right.size) continue;
    const span = right.size - left.size;
    if (span <= 0) continue;
    const t = (sizeMl - left.size) / span;
    return roundMarketPrice(left.price + t * (right.price - left.price));
  }

  return null;
}

/** Nearest 500 MMK, used for market-style quotes. */
export function roundMarketPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(500, Math.round(value / 500) * 500);
}

/** Estimate a market sell price from liquid cost per ml when the scent is not on the sheet. */
export function estimateMarketSell(
  costPerMl: number | null | undefined,
  sizeMl: number,
): number {
  if (!isPriceListSize(sizeMl)) return 0;
  const cost = Number(costPerMl);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const fit = MARKET_FIT[sizeMl];
  return roundMarketPrice(fit.slope * cost + fit.intercept);
}

/**
 * Sell price for one scent and decant size.
 * Saved override, then Pricing Strategy II market price, then cost estimate.
 */
export function resolveSellPrice(opts: {
  label: string;
  sizeMl: number;
  costPerMl?: number | null;
  saved?: number | null;
}): { price: number; source: PriceSource } {
  const saved = Number(opts.saved);
  if (Number.isFinite(saved) && saved > 0) {
    return { price: Math.round(saved), source: "saved" };
  }

  const market = lookupMarketPrice(opts.label, opts.sizeMl);
  if (market) return { price: market, source: "market" };

  const between = interpolateMarketPrice(opts.label, opts.sizeMl);
  if (between) return { price: between, source: "market" };

  const estimated = estimateMarketSell(opts.costPerMl, opts.sizeMl);
  if (estimated > 0) return { price: estimated, source: "cost" };

  const cost = Number(opts.costPerMl);
  if (Number.isFinite(cost) && cost > 0 && opts.sizeMl > 0) {
    const ten = estimateMarketSell(cost, 10);
    if (ten > 0) {
      return { price: roundMarketPrice(ten * (opts.sizeMl / 10)), source: "cost" };
    }
  }

  return { price: 0, source: "none" };
}

export function suggestSalePrice(opts: {
  listPrice?: number | null;
  unitCogs?: number | null;
  margin?: number;
  label?: string;
  sizeMl?: number;
  costPerMl?: number | null;
}): number {
  const list = Number(opts.listPrice);
  if (Number.isFinite(list) && list > 0) return Math.round(list);

  if (opts.label && opts.sizeMl) {
    const resolved = resolveSellPrice({
      label: opts.label,
      sizeMl: opts.sizeMl,
      costPerMl: opts.costPerMl,
    });
    if (resolved.price > 0) return resolved.price;
  }

  const cogs = Number(opts.unitCogs);
  if (!Number.isFinite(cogs) || cogs <= 0) return 0;

  const margin = opts.margin ?? DEFAULT_SALE_MARGIN;
  return roundMarketPrice(cogs * (1 + margin));
}

export type ConsumableCostRow = {
  name: string;
  category: string;
  unitCost: number;
  isActive?: boolean;
  updatedAt?: string;
};

/** Consumable the user can tick into Tools Cost. Bottles and caps are not tools. */
export type ToolChoice = {
  id: string;
  name: string;
  unitCost: number;
};

/** Bottle cost by size, plus other consumables (box, sticker, syringe). */
export type PackagingCosts = {
  bottleBySize: Partial<Record<PriceListSize, number>>;
  extraBySize: Partial<Record<PriceListSize, number>>;
  shared: number;
};

export const EMPTY_PACKAGING: PackagingCosts = {
  bottleBySize: {},
  extraBySize: {},
  shared: 0,
};

/** Stock average when a consumable has been counted, otherwise the master cost. */
export function liveUnitCost(masterCost: number, stockAvg?: number | null) {
  if (stockAvg != null && stockAvg > 0) return stockAvg;
  return masterCost > 0 ? masterCost : 0;
}

/** "10ml bottle" and "10 ml" match a price-list size. "100ml" does not. */
export function consumableDecantSize(name: string): PriceListSize | null {
  const match = name.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (!match) return null;
  const size = Number(match[1]);
  return isPriceListSize(size) ? size : null;
}

/**
 * Stock grouping. Bottle cost is the newest active Bottle for that ml.
 * The price list does not use the shared total from here. Tools are only
 * the items the user ticks, via packagingFromChoices.
 */
export function packagingFromConsumables(rows: ConsumableCostRow[]): PackagingCosts {
  const bottles: Partial<Record<PriceListSize, ConsumableCostRow>> = {};
  const extraBySize: Partial<Record<PriceListSize, number>> = {};
  let shared = 0;

  for (const row of rows) {
    if (row.isActive === false) continue;
    if (!(row.unitCost > 0)) continue;
    if (row.category.trim().toLowerCase() === "cap") continue;
    const size = consumableDecantSize(row.name);
    const isBottle = row.category.trim().toLowerCase() === "bottle";
    if (isBottle) {
      if (!size) continue;
      const current = bottles[size];
      const newer = (row.updatedAt ?? "").localeCompare(current?.updatedAt ?? "") >= 0;
      if (!current || newer) bottles[size] = row;
      continue;
    }
    if (size) {
      extraBySize[size] = (extraBySize[size] ?? 0) + row.unitCost;
    } else {
      shared += row.unitCost;
    }
  }

  const bottleBySize: Partial<Record<PriceListSize, number>> = {};
  for (const size of PRICE_LIST_SIZES) {
    const cost = bottles[size]?.unitCost;
    if (cost && cost > 0) bottleBySize[size] = cost;
  }
  return { bottleBySize, extraBySize, shared };
}

export function isToolCandidate(category: string) {
  const kind = category.trim().toLowerCase();
  return kind !== "bottle" && kind !== "cap";
}

/**
 * Margin cost for a decant: the normal bottle price for that ml, plus only
 * the tool items the user selected. Nothing else is added automatically.
 */
export function packagingFromChoices(opts: {
  bottleBySize: Partial<Record<PriceListSize, number>>;
  tools: ToolChoice[];
  selectedToolIds: readonly string[];
}): PackagingCosts {
  const selected = new Set(opts.selectedToolIds);
  let shared = 0;
  for (const tool of opts.tools) {
    if (!selected.has(tool.id)) continue;
    if (tool.unitCost > 0) shared += tool.unitCost;
  }

  const bottleBySize: Partial<Record<PriceListSize, number>> = {};
  for (const size of PRICE_LIST_SIZES) {
    const cost = opts.bottleBySize[size];
    if (cost && cost > 0) bottleBySize[size] = cost;
  }
  return { bottleBySize, extraBySize: {}, shared };
}

/**
 * Before the user saves, bottle cost is the stock bottle for that ml.
 * After they save, only the normal prices they typed are used.
 */
export function resolveNormalBottles(opts: {
  configured: boolean;
  saved: Partial<Record<PriceListSize, number>>;
  stock: Partial<Record<PriceListSize, number>>;
}) {
  return opts.configured ? opts.saved : opts.stock;
}

/** Null until saved. An object means the user has set normal bottle prices. */
export function parseNormalBottles(value: unknown): {
  configured: boolean;
  bottles: Partial<Record<PriceListSize, number>>;
} {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { configured: false, bottles: {} };
  }
  const bottles: Partial<Record<PriceListSize, number>> = {};
  for (const size of PRICE_LIST_SIZES) {
    const raw = (value as Record<string, unknown>)[String(size)];
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) bottles[size] = num;
  }
  return { configured: true, bottles };
}

/** Null when that size has no bottle cost yet. */
export function packagingCostForSize(packaging: PackagingCosts, sizeMl: number) {
  if (!isPriceListSize(sizeMl)) return null;
  const bottle = packaging.bottleBySize[sizeMl];
  if (!(bottle && bottle > 0)) return null;
  return bottle + (packaging.extraBySize[sizeMl] ?? 0) + packaging.shared;
}

/** Extra charged only when the customer asks for a cap bottle. Not part of the price list. */
export type CapExtras = {
  bySize: Partial<Record<PriceListSize, number>>;
  shared: number;
};

export const EMPTY_CAPS: CapExtras = { bySize: {}, shared: 0 };

export function capExtrasFromConsumables(rows: ConsumableCostRow[]): CapExtras {
  const bySize: Partial<Record<PriceListSize, number>> = {};
  let shared = 0;
  for (const row of rows) {
    if (row.isActive === false) continue;
    if (!(row.unitCost > 0)) continue;
    if (row.category.trim().toLowerCase() !== "cap") continue;
    const size = consumableDecantSize(row.name);
    if (size) bySize[size] = (bySize[size] ?? 0) + row.unitCost;
    else shared += row.unitCost;
  }
  return { bySize, shared };
}

export function capExtraForSize(caps: CapExtras, sizeMl: number) {
  const sized = isPriceListSize(sizeMl) ? (caps.bySize[sizeMl] ?? 0) : 0;
  return sized + caps.shared;
}

export function marginRate(price: number, cogs: number) {
  if (!(price > 0) || !Number.isFinite(cogs)) return null;
  return (price - cogs) / price;
}

export function formatMargin(rate: number | null) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Nearest 1,000 MMK, used for full-bottle prices. */
export function roundTo1000(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1000, Math.round(value / 1000) * 1000);
}

function bestNamedMatch<T extends { name: string }>(label: string, items: T[]) {
  const query = scentTokens(label);
  if (!query.length) return null;
  const querySet = new Set(query);
  let best: { item: T; score: number; extra: number } | null = null;

  for (const item of items) {
    const tokens = scentTokens(item.name);
    const shared = tokens.filter((token) => querySet.has(token));
    if (!shared.length) continue;
    const shorter = Math.min(querySet.size, tokens.length);
    if (shared.length / shorter < 0.6) continue;
    if (shared.length < 2 && shorter > 1) continue;
    const extra = tokens.length - shared.length + (querySet.size - shared.length);
    const score = shared.length * 10 - extra;
    if (!best || score > best.score || (score === best.score && extra < best.extra)) {
      best = { item, score, extra };
    }
  }
  return best?.item ?? null;
}

export function lookupFullBottle(label: string) {
  return bestNamedMatch(label, FULL_BOTTLE_PRICES);
}

/**
 * Full-bottle market price from the Full Bottle sheet.
 * If the scent is not listed, 35% margin on bottle cost, rounded to 1,000.
 */
export function fullBottleQuote(opts: {
  label: string;
  costPerMl: number;
  bottleSizeMl: number;
}) {
  const listed = lookupFullBottle(opts.label);
  const sizeMl =
    listed && listed.sizeMl > 0 ? listed.sizeMl : opts.bottleSizeMl;
  const liquidCost =
    opts.costPerMl > 0 && sizeMl > 0 ? opts.costPerMl * sizeMl : 0;
  const cogs = liquidCost > 0 ? liquidCost : (listed?.sourceCost ?? 0);
  const price = listed?.sellPrice
    ? listed.sellPrice
    : roundTo1000(cogs / 0.65);
  return {
    sizeMl,
    price,
    cogs,
    margin: marginRate(price, cogs),
    fromSheet: Boolean(listed),
  };
}

/**
 * Cost behind a decant or leftover quote.
 * A standard size adds the current consumable bottle and packaging, not a fixed sheet amount.
 */
export function quoteCogs(
  costPerMl: number,
  sizeMl: number,
  leftover: boolean,
  packagingCost = 0,
) {
  const liquid = Math.max(0, costPerMl) * Math.max(0, sizeMl);
  if (leftover || !isPriceListSize(sizeMl)) return liquid;
  return liquid + Math.max(0, packagingCost);
}
