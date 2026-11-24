"use client";

import { useMemo, useState, useTransition } from "react";

import { savePriceListCosts, upsertPriceList } from "@/lib/actions/pricing";
import {
  BOTTLE_COST_SIZES,
  PRICE_LIST_SIZES,
  brandFromPerfumeLabel,
  bumpPrice,
  capExtraForSize,
  formatMargin,
  marginHealth,
  marginRate,
  packagingCostForSize,
  packagingFromChoices,
  priceFloorFromCogs,
  quoteCogs,
  resolveSellPrice,
  toolsApplyToSize,
  type BottleCostSize,
  type CapChoice,
  type CapExtras,
  type MarginHealth,
  type PackagingCosts,
  type PriceListSize,
  type PriceSource,
  type ToolChoice,
} from "@/lib/domain/pricing";
import { btnPrimaryClass, btnSecondaryClass, cn, fieldClass, formatMmk } from "@/lib/ui";

export type PriceListPerfume = {
  id: string;
  label: string;
  costPerMl: number;
  /** Liquid ml on hand. 0 = sold out / not in stock. */
  quantityMl: number;
  bottleSizeMl?: number;
  sellChannel?: "DECANT" | "SEALED" | "BOTH";
};

type PriceListEditorProps = {
  perfumes: PriceListPerfume[];
  /** Map key: `${perfumeId}:${sizeMl}` → saved override */
  initialPrices: Record<string, number>;
  tools: ToolChoice[];
  initialToolIds: string[];
  initialToolSizes: BottleCostSize[];
  initialBottles: Partial<Record<BottleCostSize, number>>;
  stockBottles: Partial<Record<BottleCostSize, number>>;
  caps: CapExtras;
  capItems: CapChoice[];
};

type ViewMode = "check" | "edit";
type SizeFilter = "all" | PriceListSize;

function cellKey(perfumeId: string, sizeMl: number) {
  return `${perfumeId}:${sizeMl}`;
}

function bottleFields(
  bottles: Partial<Record<BottleCostSize, number>>,
): Record<BottleCostSize, string> {
  const next = {} as Record<BottleCostSize, string>;
  for (const size of BOTTLE_COST_SIZES) {
    const value = bottles[size];
    next[size] = value && value > 0 ? String(Math.round(value)) : "";
  }
  return next;
}

function cellMarginInfo(
  perfume: PriceListPerfume,
  sizeMl: number,
  raw: string,
  packaging: PackagingCosts,
): {
  label: string;
  health: MarginHealth;
  floor: number;
} {
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) {
    return { label: "", health: "unknown", floor: 0 };
  }
  if (!(perfume.costPerMl > 0)) {
    return { label: "No cost/ml", health: "unknown", floor: 0 };
  }
  const packagingCost = packagingCostForSize(packaging, sizeMl);
  if (packagingCost == null) {
    return { label: "No bottle cost", health: "unknown", floor: 0 };
  }
  const cogs = quoteCogs(perfume.costPerMl, sizeMl, false, packagingCost);
  const floor = priceFloorFromCogs(cogs);
  return {
    label: formatMargin(marginRate(price, cogs)),
    health: marginHealth(price, cogs),
    floor,
  };
}

function marginTone(health: MarginHealth) {
  if (health === "below_cost" || health === "thin") return "text-[var(--danger)]";
  if (health === "ok") return "text-[var(--success)]";
  return "text-[var(--muted)]";
}

function sourceLabel(source: PriceSource) {
  if (source === "market") return "Market";
  if (source === "cost") return "From cost";
  if (source === "saved") return "Saved";
  return "";
}

export function PriceListEditor({
  perfumes,
  initialPrices,
  tools,
  initialToolIds,
  initialToolSizes,
  initialBottles,
  stockBottles,
  caps,
  capItems,
}: PriceListEditorProps) {
  const baseline = useMemo(() => {
    const next: Record<string, number> = {};
    for (const perfume of perfumes) {
      for (const size of PRICE_LIST_SIZES) {
        const key = cellKey(perfume.id, size);
        const resolved = resolveSellPrice({
          label: perfume.label,
          sizeMl: size,
          costPerMl: perfume.costPerMl,
          saved: initialPrices[key],
        });
        if (resolved.price > 0) next[key] = resolved.price;
      }
    }
    return next;
  }, [perfumes, initialPrices]);

  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(baseline)) {
      next[key] = String(value);
    }
    return next;
  });
  const [query, setQuery] = useState("");
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [mode, setMode] = useState<ViewMode>("check");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toolIds, setToolIds] = useState<string[]>(initialToolIds);
  const [toolSizes, setToolSizes] = useState<BottleCostSize[]>(initialToolSizes);
  const [bottleText, setBottleText] = useState<Record<BottleCostSize, string>>(
    () => bottleFields(initialBottles),
  );
  const [costMessage, setCostMessage] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [costPending, startCostSave] = useTransition();
  const [bumpPercent, setBumpPercent] = useState("10");
  const [bumpBrand, setBumpBrand] = useState("all");
  const [bumpMessage, setBumpMessage] = useState<string | null>(null);

  const packaging = useMemo(() => {
    const bottleBySize: Partial<Record<BottleCostSize, number>> = {};
    for (const size of BOTTLE_COST_SIZES) {
      const num = Number(bottleText[size]);
      if (Number.isFinite(num) && num > 0) bottleBySize[size] = num;
    }
    return packagingFromChoices({
      bottleBySize,
      tools,
      selectedToolIds: toolIds,
      toolSizes,
    });
  }, [bottleText, tools, toolIds, toolSizes]);

  const visibleSizes = useMemo(
    () =>
      sizeFilter === "all"
        ? [...PRICE_LIST_SIZES]
        : PRICE_LIST_SIZES.filter((s) => s === sizeFilter),
    [sizeFilter],
  );

  const soldOutCount = useMemo(
    () => perfumes.filter((p) => !(p.quantityMl > 0)).length,
    [perfumes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return perfumes.filter((p) => {
      // Explicit Decant pour always lists (even 0 ml / never poured).
      // Both still hides empty bottles unless Sold out is ticked.
      if (
        !showSoldOut &&
        !(p.quantityMl > 0) &&
        p.sellChannel !== "DECANT"
      ) {
        return false;
      }
      if (!q) return true;
      return p.label.toLowerCase().includes(q);
    });
  }, [perfumes, query, showSoldOut]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const perfume of perfumes) {
      const brand = brandFromPerfumeLabel(perfume.label);
      if (brand) set.add(brand);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [perfumes]);

  function setCell(perfumeId: string, sizeMl: number, value: string) {
    const key = cellKey(perfumeId, sizeMl);
    setPrices((prev) => ({ ...prev, [key]: value }));
  }

  function applyBump() {
    setBumpMessage(null);
    setError(null);
    const percent = Number(bumpPercent);
    if (!Number.isFinite(percent) || percent === 0) {
      setError("Enter a bump % (e.g. 10 for +10%).");
      return;
    }
    const targets = filtered.filter((perfume) => {
      if (bumpBrand === "all") return true;
      return brandFromPerfumeLabel(perfume.label) === bumpBrand;
    });
    if (!targets.length) {
      setError("No scents match this bump filter.");
      return;
    }

    const next = { ...prices };
    let changed = 0;
    for (const perfume of targets) {
      for (const size of visibleSizes) {
        const key = cellKey(perfume.id, size);
        const current = Number(next[key] ?? baseline[key] ?? 0);
        if (!(current > 0)) continue;
        const bumped = bumpPrice(current, percent);
        if (bumped > 0 && bumped !== Math.round(current)) {
          next[key] = String(bumped);
          changed += 1;
        }
      }
    }
    setPrices(next);
    setBumpMessage(
      changed > 0
        ? `Bumped ${changed} price${changed === 1 ? "" : "s"} by ${percent}%. Save to keep.`
        : "Nothing to bump for this filter.",
    );
  }

  function cellSource(perfume: PriceListPerfume, sizeMl: number, raw: string) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return "";
    const key = cellKey(perfume.id, sizeMl);
    const saved = initialPrices[key];
    if (saved && Math.round(saved) === Math.round(num)) return "Saved";
    const auto = resolveSellPrice({
      label: perfume.label,
      sizeMl,
      costPerMl: perfume.costPerMl,
    });
    if (auto.price === Math.round(num)) return sourceLabel(auto.source);
    return "Custom";
  }

  function onSave() {
    setMessage(null);
    setError(null);
    const cells: Array<{
      perfume_id: string;
      size_ml: number;
      sell_price_mmk: number;
    }> = [];

    for (const perfume of perfumes) {
      for (const size of PRICE_LIST_SIZES) {
        const key = cellKey(perfume.id, size);
        const raw = (prices[key] ?? "").trim();
        const base = baseline[key] ?? 0;
        if (raw === "" && !initialPrices[key]) continue;
        const num = raw === "" ? 0 : Number(raw);
        if (!Number.isFinite(num) || num < 0) {
          setError(`Invalid price for ${perfume.label} ${size}ml`);
          return;
        }
        if (Math.round(num) === base) continue;
        cells.push({
          perfume_id: perfume.id,
          size_ml: size,
          sell_price_mmk: num,
        });
      }
    }

    if (!cells.length) {
      setMessage("No changes to save.");
      return;
    }

    startTransition(async () => {
      const result = await upsertPriceList({ cells });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Saved ${result.updated ?? cells.length} price(s).`);
    });
  }

  function toggleTool(id: string) {
    setCostMessage(null);
    setToolIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleToolSize(size: BottleCostSize) {
    setCostMessage(null);
    setToolSizes((prev) =>
      prev.includes(size)
        ? prev.filter((item) => item !== size)
        : [...prev, size].sort((a, b) => a - b),
    );
  }

  function onSaveCosts() {
    setCostMessage(null);
    setCostError(null);
    const bottles = {} as Record<BottleCostSize, number>;
    for (const size of BOTTLE_COST_SIZES) {
      const num = Number(bottleText[size]);
      if (bottleText[size].trim() !== "" && (!Number.isFinite(num) || num < 0)) {
        setCostError(`Invalid bottle price for ${size}ml`);
        return;
      }
      bottles[size] = Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
    }

    startCostSave(async () => {
      const result = await savePriceListCosts({
        tool_ids: toolIds,
        tool_sizes: toolSizes,
        bottles,
      });
      if (!result.ok) {
        setCostError(result.error);
        return;
      }
      setCostMessage("Saved tools and bottle prices.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-[3.25rem] z-20 -mx-4 space-y-3 border-b border-[var(--stroke)] bg-[var(--canvas)]/95 px-4 py-3 backdrop-blur md:top-[3.5rem] lg:mx-0 lg:border lg:bg-[var(--surface)] lg:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              className={`${fieldClass} sm:max-w-sm`}
              placeholder="Search scent…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showSoldOut}
                onChange={(e) => setShowSoldOut(e.target.checked)}
              />
              Sold out
              {soldOutCount > 0 ? (
                <span className="text-[var(--muted)]">({soldOutCount})</span>
              ) : null}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden border border-[var(--stroke)]">
              <button
                type="button"
                className={cn(
                  "min-h-11 px-3 text-sm font-medium",
                  mode === "check"
                    ? "bg-[var(--ink)] text-white"
                    : "bg-[var(--surface)] text-[var(--ink-soft)]",
                )}
                onClick={() => setMode("check")}
              >
                Check
              </button>
              <button
                type="button"
                className={cn(
                  "min-h-11 border-l border-[var(--stroke)] px-3 text-sm font-medium",
                  mode === "edit"
                    ? "bg-[var(--ink)] text-white"
                    : "bg-[var(--surface)] text-[var(--ink-soft)]",
                )}
                onClick={() => setMode("edit")}
              >
                Edit
              </button>
            </div>
            {mode === "edit" ? (
              <button
                type="button"
                className={btnPrimaryClass}
                disabled={pending}
                onClick={onSave}
              >
                {pending ? "Saving…" : "Save prices"}
              </button>
            ) : null}
          </div>
        </div>

        {mode === "edit" ? (
          <div className="flex flex-col gap-2 border border-[var(--stroke)] bg-[var(--surface)] p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block min-w-[7rem] space-y-1">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                Bump %
              </span>
              <input
                type="number"
                step="1"
                className={fieldClass}
                value={bumpPercent}
                onChange={(e) => setBumpPercent(e.target.value)}
                aria-label="Price bump percent"
              />
            </label>
            <label className="block min-w-[10rem] flex-1 space-y-1">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                Brand
              </span>
              <select
                className={fieldClass}
                value={bumpBrand}
                onChange={(e) => setBumpBrand(e.target.value)}
                aria-label="Brand to bump"
              >
                <option value="all">All visible brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={btnSecondaryClass}
              onClick={applyBump}
            >
              Apply bump
            </button>
            <p className="w-full text-xs text-[var(--muted)] sm:w-auto sm:flex-1">
              Uses current filter + size chips. Then Save prices.
            </p>
          </div>
        ) : null}
        {bumpMessage ? (
          <p className="text-sm text-[var(--success)]">{bumpMessage}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Size
          </span>
          <button
            type="button"
            className={sizeFilter === "all" ? btnPrimaryClass : btnSecondaryClass}
            onClick={() => setSizeFilter("all")}
          >
            All
          </button>
          {PRICE_LIST_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={
                sizeFilter === size ? btnPrimaryClass : btnSecondaryClass
              }
              onClick={() => setSizeFilter(size)}
            >
              {size}ml
            </button>
          ))}
          <span className="ml-auto text-sm text-[var(--muted)]">
            {filtered.length} scent{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <details
        className="border border-[var(--stroke)] bg-[var(--surface)]"
        open={mode === "edit"}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--ink)]">
          Bottle + tools cost
          <span className="ml-2 font-normal text-[var(--muted)]">
            {mode === "edit" ? "(edit for margin %)" : "(per ml total)"}
          </span>
        </summary>
        <div className="space-y-4 border-t border-[var(--stroke)] p-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Total packaging cost (bottle + tools)
            </p>
            <p className="text-xs text-[var(--muted)]">
              Used for margin on the price list. Cap is separate and optional on
              a sale — it does not change these list prices.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {BOTTLE_COST_SIZES.map((size) => {
                const bottle = packaging.bottleBySize[size];
                const toolPart = toolsApplyToSize(packaging, size)
                  ? packaging.shared
                  : 0;
                const total = packagingCostForSize(packaging, size);
                return (
                  <div
                    key={size}
                    className="border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      {size}ml
                    </p>
                    <p className="mt-1 text-base font-medium tabular-nums text-[var(--ink)]">
                      {total != null ? formatMmk(total) : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-[var(--muted)]">
                      {bottle && bottle > 0
                        ? `Bottle ${formatMmk(bottle)}`
                        : "No bottle"}
                      {toolPart > 0 ? ` + tools ${formatMmk(toolPart)}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Cap / twist bottle (optional on sale)
            </p>
            <p className="text-xs text-[var(--muted)]">
              Does not change the price list. On a sale, tick Cap only when the
              customer wants it. Use category Cap or Twist bottle. Put the extra
              cost here (difference vs normal bottle), not the full purchase
              price.
            </p>
            {capItems.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {capItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3 border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2 text-sm"
                  >
                    <span>
                      {item.name}
                      <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                        {item.sizeMl != null ? `${item.sizeMl}ml` : "all sizes"}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--ink)]">
                      +{formatMmk(item.unitCost)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No Cap / Twist bottle items yet. Add under Consumables.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {PRICE_LIST_SIZES.map((size) => {
                const extra = capExtraForSize(caps, size);
                return (
                  <div
                    key={size}
                    className="border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      {size}ml add-on
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-[var(--ink)]">
                      {extra > 0 ? `+${formatMmk(extra)}` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Tools cost
            </p>
            {tools.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {tools.map((tool) => (
                  <li key={tool.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={toolIds.includes(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                        disabled={mode !== "edit"}
                      />
                      <span>{tool.name}</span>
                      <span className="tabular-nums text-[var(--muted)]">
                        {formatMmk(tool.unitCost)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No tool items yet. Add under Consumables, then tick here.
              </p>
            )}
            <p className="text-sm tabular-nums">
              {packaging.shared > 0
                ? `Tools ${formatMmk(packaging.shared)} per vial on selected sizes`
                : "Tools 0 — nothing ticked"}
            </p>
            <div className="space-y-2 pt-1">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Apply tools to sizes
              </p>
              {mode === "edit" ? (
                <p className="text-xs text-[var(--muted)]">
                  Leave 2ml unticked for discovery sets — one syringe pours many
                  vials, so do not charge syringe on every 2ml.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {BOTTLE_COST_SIZES.map((size) => (
                  <label
                    key={size}
                    className="flex min-h-11 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={toolSizes.includes(size)}
                      onChange={() => toggleToolSize(size)}
                      disabled={mode !== "edit"}
                    />
                    {size}ml
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Normal bottle price
            </p>
            <p className="text-xs text-[var(--muted)]">
              Includes 2ml for bundle sets. Enter bottle only — tools are added
              above in the per-ml total.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {BOTTLE_COST_SIZES.map((size) => {
                const stock = stockBottles[size];
                const withTools = toolsApplyToSize(packaging, size);
                if (mode !== "edit") {
                  const bottle = packaging.bottleBySize[size];
                  return (
                    <div
                      key={size}
                      className="border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2"
                    >
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                        {size}ml
                      </p>
                      <p className="mt-1 text-sm tabular-nums text-[var(--ink)]">
                        {bottle && bottle > 0 ? formatMmk(bottle) : "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {stock && stock > 0
                          ? `Stock ${formatMmk(stock)}`
                          : "No stock bottle"}
                      </p>
                    </div>
                  );
                }
                return (
                  <label key={size} className="block space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      {size}ml
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className={fieldClass}
                      value={bottleText[size]}
                      placeholder="—"
                      onChange={(e) => {
                        setCostMessage(null);
                        setBottleText((prev) => ({
                          ...prev,
                          [size]: e.target.value,
                        }));
                      }}
                    />
                    <span className="block text-[11px] text-[var(--muted)]">
                      {stock && stock > 0
                        ? `Stock cost ${formatMmk(stock)}`
                        : "No stock bottle"}
                      {withTools && packaging.shared > 0
                        ? ` · + tools ${formatMmk(packaging.shared)}`
                        : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {mode === "edit" ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={btnPrimaryClass}
                disabled={costPending}
                onClick={onSaveCosts}
              >
                {costPending ? "Saving…" : "Save tools and bottles"}
              </button>
              {costError ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {costError}
                </p>
              ) : null}
              {costMessage ? (
                <p className="text-sm text-[var(--success)]" role="status">
                  {costMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Switch to Edit to change tools and bottle prices.
            </p>
          )}
        </div>
      </details>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}

      {!filtered.length ? (
        <p className="text-sm text-[var(--muted)]">
          {showSoldOut
            ? "No perfumes match."
            : "No Decant pour scents match. Set Price list to Decant pour or Both on Inventory → Perfumes, or tick Sold out for empty Both-channel bottles."}
        </p>
      ) : mode === "check" ? (
        <div className="overflow-hidden border border-[var(--stroke)] bg-[var(--surface)]">
          <ul className="divide-y divide-[var(--stroke)]">
            {filtered.map((perfume) => {
              const soldOut = !(perfume.quantityMl > 0);
              return (
                <li
                  key={perfume.id}
                  className="px-3 py-3 sm:px-4 sm:py-3.5"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p
                      className={cn(
                        "text-base font-medium sm:text-lg",
                        soldOut && "text-[var(--muted)]",
                      )}
                    >
                      {perfume.label}
                    </p>
                    {soldOut ? (
                      <span className="inline-flex border border-[var(--danger)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                        Sold out
                      </span>
                    ) : (
                      <span className="text-xs tabular-nums text-[var(--muted)]">
                        {Math.round(perfume.quantityMl * 100) / 100} ml
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      "mt-3 grid gap-2",
                      visibleSizes.length === 1
                        ? "grid-cols-1 max-w-xs"
                        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
                    )}
                  >
                    {visibleSizes.map((size) => {
                      const key = cellKey(perfume.id, size);
                      const raw = prices[key] ?? "";
                      const amount = Number(raw) || 0;
                      const info = cellMarginInfo(
                        perfume,
                        size,
                        raw,
                        packaging,
                      );
                      return (
                        <div
                          key={size}
                          className={cn(
                            "border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5",
                            visibleSizes.length === 1 && "sm:px-4 sm:py-3",
                          )}
                        >
                          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                            {size}ml
                          </p>
                          <p
                            className={cn(
                              "mt-1 font-[family-name:var(--font-display)] tabular-nums tracking-[-0.02em] text-[var(--ink)]",
                              visibleSizes.length === 1
                                ? "text-3xl"
                                : "text-xl sm:text-2xl",
                            )}
                          >
                            {amount > 0 ? formatMmk(amount) : "—"}
                          </p>
                          {info.label ? (
                            <p
                              className={cn(
                                "mt-0.5 text-sm tabular-nums",
                                marginTone(info.health),
                              )}
                            >
                              {info.label}
                            </p>
                          ) : null}
                          {info.health === "below_cost" ||
                          info.health === "thin" ? (
                            <p className="mt-0.5 text-[11px] text-[var(--danger)]">
                              {info.health === "below_cost"
                                ? "Below cost"
                                : `Floor ${formatMmk(info.floor)}`}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="sticky top-0 border-b border-[var(--stroke)] bg-[var(--surface)] text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="sticky left-0 bg-[var(--surface)] px-3 py-3 font-medium">
                    Scent
                  </th>
                  {visibleSizes.map((size) => (
                    <th key={size} className="px-2 py-3 font-medium">
                      {size}ml
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((perfume) => {
                  const soldOut = !(perfume.quantityMl > 0);
                  return (
                    <tr
                      key={perfume.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="sticky left-0 bg-[var(--surface)] px-3 py-2 font-medium">
                        <span
                          className={
                            soldOut ? "text-[var(--muted)]" : undefined
                          }
                        >
                          {perfume.label}
                        </span>
                        {soldOut ? (
                          <span className="ml-2 inline-flex border border-[var(--danger)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                            Sold out
                          </span>
                        ) : (
                          <span className="ml-2 text-[11px] font-normal tabular-nums text-[var(--muted)]">
                            {Math.round(perfume.quantityMl * 100) / 100} ml
                          </span>
                        )}
                      </td>
                      {visibleSizes.map((size) => {
                        const key = cellKey(perfume.id, size);
                        const raw = prices[key] ?? "";
                        const source = cellSource(perfume, size, raw);
                        const info = cellMarginInfo(
                          perfume,
                          size,
                          raw,
                          packaging,
                        );
                        return (
                          <td key={size} className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              className="w-full min-w-[5.5rem] border border-[var(--stroke)] bg-[var(--canvas)] px-2 py-1.5 tabular-nums outline-none focus:border-[var(--accent)]"
                              value={raw}
                              placeholder="—"
                              onChange={(e) =>
                                setCell(perfume.id, size, e.target.value)
                              }
                            />
                            {info.label ? (
                              <p
                                className={cn(
                                  "mt-1 text-sm font-medium tabular-nums",
                                  marginTone(info.health),
                                )}
                              >
                                {info.label}
                              </p>
                            ) : null}
                            {info.health === "below_cost" ||
                            info.health === "thin" ? (
                              <p className="text-[11px] text-[var(--danger)]">
                                {info.health === "below_cost"
                                  ? "Below cost"
                                  : `Floor ${formatMmk(info.floor)}`}
                              </p>
                            ) : null}
                            {source ? (
                              <p className="text-[11px] text-[var(--muted)]">
                                {source}
                              </p>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((perfume) => {
              const soldOut = !(perfume.quantityMl > 0);
              return (
                <div
                  key={perfume.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-3"
                >
                  <p className="font-medium">
                    <span className={soldOut ? "text-[var(--muted)]" : undefined}>
                      {perfume.label}
                    </span>
                    {soldOut ? (
                      <span className="ml-2 inline-flex border border-[var(--danger)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                        Sold out
                      </span>
                    ) : (
                      <span className="ml-2 text-[11px] font-normal tabular-nums text-[var(--muted)]">
                        {Math.round(perfume.quantityMl * 100) / 100} ml
                      </span>
                    )}
                  </p>
                  <div
                    className={cn(
                      "mt-3 grid gap-2",
                      visibleSizes.length === 1
                        ? "grid-cols-1"
                        : "grid-cols-2",
                    )}
                  >
                    {visibleSizes.map((size) => {
                      const key = cellKey(perfume.id, size);
                      const val = prices[key];
                      const info = cellMarginInfo(
                        perfume,
                        size,
                        val ?? "",
                        packaging,
                      );
                      return (
                        <label key={size} className="block space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                            {size}ml
                            {info.label ? (
                              <span
                                className={cn(
                                  "ml-1 text-sm font-medium normal-case tracking-normal",
                                  marginTone(info.health),
                                )}
                              >
                                {info.label}
                              </span>
                            ) : null}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            className={fieldClass}
                            value={prices[key] ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              setCell(perfume.id, size, e.target.value)
                            }
                          />
                          {info.health === "below_cost" ||
                          info.health === "thin" ? (
                            <span className="block text-[11px] text-[var(--danger)]">
                              {info.health === "below_cost"
                                ? "Below cost"
                                : `Floor ${formatMmk(info.floor)}`}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
