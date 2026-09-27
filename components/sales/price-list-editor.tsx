"use client";

import { useMemo, useState, useTransition } from "react";

import { savePriceListCosts, upsertPriceList } from "@/lib/actions/pricing";
import {
  PRICE_LIST_SIZES,
  formatMargin,
  marginRate,
  packagingCostForSize,
  packagingFromChoices,
  quoteCogs,
  resolveSellPrice,
  type PackagingCosts,
  type PriceListSize,
  type PriceSource,
  type ToolChoice,
} from "@/lib/domain/pricing";
import { btnPrimaryClass, fieldClass, formatMmk } from "@/lib/ui";

export type PriceListPerfume = {
  id: string;
  label: string;
  costPerMl: number;
  /** Liquid ml on hand. 0 = sold out / not in stock. */
  quantityMl: number;
};

type PriceListEditorProps = {
  perfumes: PriceListPerfume[];
  /** Map key: `${perfumeId}:${sizeMl}` → saved override */
  initialPrices: Record<string, number>;
  tools: ToolChoice[];
  initialToolIds: string[];
  initialBottles: Partial<Record<PriceListSize, number>>;
  stockBottles: Partial<Record<PriceListSize, number>>;
};

function cellKey(perfumeId: string, sizeMl: number) {
  return `${perfumeId}:${sizeMl}`;
}

function bottleFields(
  bottles: Partial<Record<PriceListSize, number>>,
): Record<PriceListSize, string> {
  const next = {} as Record<PriceListSize, string>;
  for (const size of PRICE_LIST_SIZES) {
    const value = bottles[size];
    next[size] = value && value > 0 ? String(Math.round(value)) : "";
  }
  return next;
}

function cellMargin(
  perfume: PriceListPerfume,
  sizeMl: number,
  raw: string,
  packaging: PackagingCosts,
) {
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) return "";
  if (!(perfume.costPerMl > 0)) return "No cost/ml";
  const packagingCost = packagingCostForSize(packaging, sizeMl);
  if (packagingCost == null) return "No bottle cost";
  return formatMargin(
    marginRate(price, quoteCogs(perfume.costPerMl, sizeMl, false, packagingCost)),
  );
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
  initialBottles,
  stockBottles,
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toolIds, setToolIds] = useState<string[]>(initialToolIds);
  const [bottleText, setBottleText] = useState<Record<PriceListSize, string>>(
    () => bottleFields(initialBottles),
  );
  const [costMessage, setCostMessage] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [costPending, startCostSave] = useTransition();

  const packaging = useMemo(() => {
    const bottleBySize: Partial<Record<PriceListSize, number>> = {};
    for (const size of PRICE_LIST_SIZES) {
      const num = Number(bottleText[size]);
      if (Number.isFinite(num) && num > 0) bottleBySize[size] = num;
    }
    return packagingFromChoices({
      bottleBySize,
      tools,
      selectedToolIds: toolIds,
    });
  }, [bottleText, tools, toolIds]);

  const soldOutCount = useMemo(
    () => perfumes.filter((p) => !(p.quantityMl > 0)).length,
    [perfumes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return perfumes.filter((p) => {
      if (!showSoldOut && !(p.quantityMl > 0)) return false;
      if (!q) return true;
      return p.label.toLowerCase().includes(q);
    });
  }, [perfumes, query, showSoldOut]);

  function setCell(perfumeId: string, sizeMl: number, value: string) {
    const key = cellKey(perfumeId, sizeMl);
    setPrices((prev) => ({ ...prev, [key]: value }));
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

  function onSaveCosts() {
    setCostMessage(null);
    setCostError(null);
    const bottles = {} as Record<PriceListSize, number>;
    for (const size of PRICE_LIST_SIZES) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            className={`${fieldClass} sm:max-w-xs`}
            placeholder="Search perfume…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink-soft)]">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showSoldOut}
              onChange={(e) => setShowSoldOut(e.target.checked)}
            />
            Show sold out
            {soldOutCount > 0 ? (
              <span className="text-[var(--muted)]">({soldOutCount})</span>
            ) : null}
          </label>
        </div>
        <button
          type="button"
          className={btnPrimaryClass}
          disabled={pending}
          onClick={onSave}
        >
          {pending ? "Saving…" : "Save prices"}
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        In-stock scents only by default. Tick <strong>Show sold out</strong> to
        check prices for empty bottles before you restock. The percent is sale
        price minus perfume cost, the normal bottle for that ml, and only the
        tools you tick.
      </p>

      <div className="space-y-4 border border-[var(--stroke)] bg-[var(--surface)] p-4">
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
              No tool items yet. Add a syringe or converter under Consumables,
              then tick it here.
            </p>
          )}
          <p className="text-sm tabular-nums">
            {packaging.shared > 0
              ? `Tools ${formatMmk(packaging.shared)} on every size`
              : "Tools 0 — nothing ticked"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Normal bottle price
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PRICE_LIST_SIZES.map((size) => {
              const stock = stockBottles[size];
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
                  {stock && stock > 0 ? (
                    <span className="block text-[11px] text-[var(--muted)]">
                      Stock cost {formatMmk(stock)}
                    </span>
                  ) : (
                    <span className="block text-[11px] text-[var(--muted)]">
                      No stock bottle
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

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
      </div>

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
            : "No in-stock perfumes match. Tick Show sold out to see empty bottles."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="sticky left-0 bg-[var(--surface)] px-3 py-3 font-medium">
                    Scent
                  </th>
                  {PRICE_LIST_SIZES.map((size) => (
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
                      {PRICE_LIST_SIZES.map((size) => {
                        const key = cellKey(perfume.id, size);
                        const raw = prices[key] ?? "";
                        const source = cellSource(perfume, size, raw);
                        const margin = cellMargin(
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
                            {margin ? (
                              <p className="mt-1 text-sm font-medium tabular-nums">
                                {margin}
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
                  <p className="mt-2 text-sm tabular-nums">
                    {PRICE_LIST_SIZES.map((size) => {
                      const raw = prices[cellKey(perfume.id, size)] ?? "";
                      const amount = Number(raw) || 0;
                      if (amount <= 0) return null;
                      const margin = cellMargin(perfume, size, raw, packaging);
                      return `${size}ml ${formatMmk(amount)}${margin ? ` ${margin}` : ""}`;
                    })
                      .filter(Boolean)
                      .join(" · ") || "No market price yet"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {PRICE_LIST_SIZES.map((size) => {
                      const key = cellKey(perfume.id, size);
                      const val = prices[key];
                      const margin = cellMargin(
                        perfume,
                        size,
                        val ?? "",
                        packaging,
                      );
                      return (
                        <label key={size} className="block space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                            {size}ml
                            {margin ? (
                              <span className="ml-1 text-sm font-medium normal-case tracking-normal text-[var(--ink)]">
                                {margin}
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
