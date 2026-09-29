"use client";

import { useMemo, useState, useTransition } from "react";

import { upsertPriceList } from "@/lib/actions/pricing";
import {
  formatMargin,
  marginRate,
  resolveFullSizePrice,
} from "@/lib/domain/pricing";
import { btnPrimaryClass, fieldClass, formatMmk } from "@/lib/ui";

export type FullSizePerfume = {
  id: string;
  label: string;
  costPerMl: number;
  quantityMl: number;
  bottleSizeMl: number;
};

type FullSizePriceListProps = {
  perfumes: FullSizePerfume[];
  /** Map key: `${perfumeId}:${sizeMl}` → saved override */
  initialPrices: Record<string, number>;
};

function cellKey(perfumeId: string, sizeMl: number) {
  return `${perfumeId}:${sizeMl}`;
}

export function FullSizePriceList({
  perfumes,
  initialPrices,
}: FullSizePriceListProps) {
  const baseline = useMemo(() => {
    const next: Record<string, number> = {};
    for (const perfume of perfumes) {
      if (!(perfume.bottleSizeMl > 0)) continue;
      const key = cellKey(perfume.id, perfume.bottleSizeMl);
      const resolved = resolveFullSizePrice({
        label: perfume.label,
        costPerMl: perfume.costPerMl,
        bottleSizeMl: perfume.bottleSizeMl,
        saved: initialPrices[key],
      });
      if (resolved.price > 0) next[key] = resolved.price;
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

  const soldOutCount = useMemo(
    () => perfumes.filter((p) => !(p.quantityMl > 0)).length,
    [perfumes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return perfumes.filter((p) => {
      if (!(p.bottleSizeMl > 0)) return false;
      if (!showSoldOut && !(p.quantityMl > 0)) return false;
      if (!q) return true;
      return p.label.toLowerCase().includes(q);
    });
  }, [perfumes, query, showSoldOut]);

  function onSave() {
    setMessage(null);
    setError(null);
    const cells: Array<{
      perfume_id: string;
      size_ml: number;
      sell_price_mmk: number;
    }> = [];

    for (const perfume of perfumes) {
      if (!(perfume.bottleSizeMl > 0)) continue;
      const key = cellKey(perfume.id, perfume.bottleSizeMl);
      const raw = (prices[key] ?? "").trim();
      const base = baseline[key] ?? 0;
      if (raw === "" && !initialPrices[key]) continue;
      const num = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        setError(`Invalid price for ${perfume.label}`);
        return;
      }
      if (Math.round(num) === base) continue;
      cells.push({
        perfume_id: perfume.id,
        size_ml: perfume.bottleSizeMl,
        sell_price_mmk: num,
      });
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
          {pending ? "Saving…" : "Save full-size prices"}
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Full retail bottles use each scent&apos;s bottle size (30 · 90 · 100 ·
        105ml, etc.). Suggested sell comes from the full-bottle sheet, or ~35%
        margin on bottle cost. Edit and save to override.
      </p>

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
            : "No in-stock full bottles. Tick Show sold out to review prices."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Scent</th>
                  <th className="px-4 py-3 font-medium">Full size</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Bottle cost</th>
                  <th className="px-4 py-3 font-medium">Suggested</th>
                  <th className="px-4 py-3 font-medium">Sell price</th>
                  <th className="px-4 py-3 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((perfume) => {
                  const key = cellKey(perfume.id, perfume.bottleSizeMl);
                  const raw = prices[key] ?? "";
                  const quote = resolveFullSizePrice({
                    label: perfume.label,
                    costPerMl: perfume.costPerMl,
                    bottleSizeMl: perfume.bottleSizeMl,
                    saved: Number(raw) || initialPrices[key],
                  });
                  const soldOut = !(perfume.quantityMl > 0);
                  const bottlesLeft =
                    perfume.bottleSizeMl > 0
                      ? Math.floor(
                          (perfume.quantityMl + 0.0001) / perfume.bottleSizeMl,
                        )
                      : 0;
                  return (
                    <tr
                      key={perfume.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
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
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {perfume.bottleSizeMl} ml
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {soldOut
                          ? "—"
                          : `${Math.round(perfume.quantityMl * 100) / 100} ml${
                              bottlesLeft > 0 ? ` · ~${bottlesLeft}` : ""
                            }`}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {quote.cogs > 0 ? formatMmk(quote.cogs) : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {quote.suggested > 0 ? formatMmk(quote.suggested) : "—"}
                        <span className="ml-1 text-[11px]">
                          {quote.fromSheet
                            ? "sheet"
                            : quote.suggested > 0
                              ? "~35%"
                              : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          inputMode="numeric"
                          className="w-full min-w-[7rem] border border-[var(--stroke)] bg-[var(--canvas)] px-2 py-1.5 tabular-nums outline-none focus:border-[var(--accent)]"
                          value={raw}
                          placeholder="—"
                          onChange={(e) =>
                            setPrices((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium text-[var(--success)]">
                        {formatMargin(
                          marginRate(Number(raw) || quote.price, quote.cogs),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((perfume) => {
              const key = cellKey(perfume.id, perfume.bottleSizeMl);
              const raw = prices[key] ?? "";
              const quote = resolveFullSizePrice({
                label: perfume.label,
                costPerMl: perfume.costPerMl,
                bottleSizeMl: perfume.bottleSizeMl,
                saved: Number(raw) || initialPrices[key],
              });
              const soldOut = !(perfume.quantityMl > 0);
              const sell = Number(raw) || quote.price;
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
                  <p className="mt-1 tabular-nums text-[var(--muted)]">
                    {perfume.bottleSizeMl} ml · cost{" "}
                    {quote.cogs > 0 ? formatMmk(quote.cogs) : "—"} · suggest{" "}
                    {quote.suggested > 0 ? formatMmk(quote.suggested) : "—"}
                  </p>
                  <label className="mt-3 block space-y-1">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      Sell price ·{" "}
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
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

