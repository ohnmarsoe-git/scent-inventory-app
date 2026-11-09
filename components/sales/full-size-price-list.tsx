"use client";

import { useMemo, useState, useTransition } from "react";

import { upsertPriceList } from "@/lib/actions/pricing";
import {
  formatMargin,
  fullBottleSizesFor,
  marginRate,
  resolveFullSizePrice,
} from "@/lib/domain/pricing";
import {
  btnPrimaryClass,
  cn,
  fieldClass,
  formatMmk,
} from "@/lib/ui";

export type FullSizePerfume = {
  id: string;
  label: string;
  costPerMl: number;
  quantityMl: number;
  /** Perfume master default; merged into the size columns when custom. */
  bottleSizeMl: number;
};

type FullSizePriceListProps = {
  perfumes: FullSizePerfume[];
  /** Map key: `${perfumeId}:${sizeMl}` → saved override */
  initialPrices: Record<string, number>;
};

type ViewMode = "check" | "edit";

function cellKey(perfumeId: string, sizeMl: number) {
  return `${perfumeId}:${sizeMl}`;
}

export function FullSizePriceList({
  perfumes,
  initialPrices,
}: FullSizePriceListProps) {
  const sizes = useMemo(
    () => fullBottleSizesFor(...perfumes.map((p) => p.bottleSizeMl)),
    [perfumes],
  );

  const baseline = useMemo(() => {
    const next: Record<string, number> = {};
    for (const perfume of perfumes) {
      for (const size of sizes) {
        const key = cellKey(perfume.id, size);
        const resolved = resolveFullSizePrice({
          label: perfume.label,
          costPerMl: perfume.costPerMl,
          bottleSizeMl: size,
          saved: initialPrices[key],
        });
        if (resolved.price > 0) next[key] = resolved.price;
      }
    }
    return next;
  }, [perfumes, initialPrices, sizes]);

  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(baseline)) {
      next[key] = String(value);
    }
    return next;
  });
  const [query, setQuery] = useState("");
  const [focusSize, setFocusSize] = useState<number | null>(null);
  const [showSoldOut, setShowSoldOut] = useState(false);
  const [mode, setMode] = useState<ViewMode>("check");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const visibleSizes = focusSize == null ? sizes : [focusSize];

  function onSave() {
    setMessage(null);
    setError(null);
    const cells: Array<{
      perfume_id: string;
      size_ml: number;
      sell_price_mmk: number;
    }> = [];

    for (const perfume of perfumes) {
      for (const size of sizes) {
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
      setMessage(`Saved ${result.updated ?? cells.length} full-size price(s).`);
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
            <span className="text-sm text-[var(--muted)]">
              {filtered.length} scent{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "min-h-9 border px-3 text-sm",
              focusSize == null
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--stroke)] bg-[var(--surface)] text-[var(--ink-soft)]",
            )}
            onClick={() => setFocusSize(null)}
          >
            All sizes
          </button>
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              className={cn(
                "min-h-9 border px-3 text-sm tabular-nums",
                focusSize === size
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--stroke)] bg-[var(--surface)] text-[var(--ink-soft)]",
              )}
              onClick={() =>
                setFocusSize((prev) => (prev === size ? null : size))
              }
            >
              {size}ml
            </button>
          ))}
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
            : "No in-stock full bottles. Tick Sold out to review prices."}
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
                        {Math.round(perfume.quantityMl * 100) / 100} ml liquid
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      "mt-3 grid gap-2",
                      visibleSizes.length === 1
                        ? "grid-cols-1 max-w-xs"
                        : "grid-cols-2 sm:grid-cols-4",
                    )}
                  >
                    {visibleSizes.map((size) => {
                      const key = cellKey(perfume.id, size);
                      const raw = prices[key] ?? "";
                      const quote = resolveFullSizePrice({
                        label: perfume.label,
                        costPerMl: perfume.costPerMl,
                        bottleSizeMl: size,
                        saved: Number(raw) || initialPrices[key],
                      });
                      const sell = Number(raw) || quote.price;
                      const bottlesLeft =
                        !soldOut && size > 0
                          ? Math.floor(
                              (perfume.quantityMl + 0.0001) / size,
                            )
                          : 0;
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
                            {!soldOut && bottlesLeft > 0
                              ? ` · ~${bottlesLeft}`
                              : ""}
                          </p>
                          <p
                            className={cn(
                              "mt-1 font-[family-name:var(--font-display)] tabular-nums tracking-[-0.02em] text-[var(--ink)]",
                              visibleSizes.length === 1
                                ? "text-3xl"
                                : "text-xl sm:text-2xl",
                            )}
                          >
                            {sell > 0 ? formatMmk(sell) : "—"}
                          </p>
                          {sell > 0 && quote.cogs > 0 ? (
                            <p className="mt-0.5 text-sm tabular-nums text-[var(--success)]">
                              {formatMargin(marginRate(sell, quote.cogs))}
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
                        const quote = resolveFullSizePrice({
                          label: perfume.label,
                          costPerMl: perfume.costPerMl,
                          bottleSizeMl: size,
                          saved: Number(raw) || initialPrices[key],
                        });
                        return (
                          <td key={size} className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              inputMode="numeric"
                              className="w-full min-w-[6.5rem] border border-[var(--stroke)] bg-[var(--canvas)] px-2 py-1.5 tabular-nums outline-none focus:border-[var(--accent)]"
                              value={raw}
                              placeholder="—"
                              onChange={(e) =>
                                setPrices((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                            <p className="mt-1 text-[11px] tabular-nums text-[var(--muted)]">
                              {quote.cogs > 0
                                ? `cost ${formatMmk(quote.cogs)}`
                                : "—"}
                              {Number(raw) || quote.price
                                ? ` · ${formatMargin(
                                    marginRate(
                                      Number(raw) || quote.price,
                                      quote.cogs,
                                    ),
                                  )}`
                                : ""}
                            </p>
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
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
                >
                  <p className="font-medium">
                    {perfume.label}
                    {soldOut ? (
                      <span className="ml-2 inline-flex border border-[var(--danger)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                        Sold out
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {visibleSizes.map((size) => {
                      const key = cellKey(perfume.id, size);
                      const raw = prices[key] ?? "";
                      const quote = resolveFullSizePrice({
                        label: perfume.label,
                        costPerMl: perfume.costPerMl,
                        bottleSizeMl: size,
                        saved: Number(raw) || initialPrices[key],
                      });
                      const sell = Number(raw) || quote.price;
                      return (
                        <label key={size} className="block space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                            {size}ml ·{" "}
                            {formatMargin(marginRate(sell, quote.cogs))}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            inputMode="numeric"
                            className={fieldClass}
                            value={raw}
                            placeholder="—"
                            onChange={(e) =>
                              setPrices((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
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
