"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createBundleSet, updateBundleSet } from "@/lib/actions/bundles";
import { BUNDLE_SIZES, quoteBundleSet } from "@/lib/domain/bundles";
import { formatMargin } from "@/lib/domain/pricing";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  bundleSetSchema,
  type BundleSetInput,
} from "@/lib/validations/bundles";

export type PerfumeOption = {
  id: string;
  label: string;
  cost_per_ml?: number | null;
  ml_on_hand?: number;
};

type ItemDraft = { perfume_id: string; quantity: number };

type BundleSetFormProps = {
  mode: "create" | "edit";
  bundleId?: string;
  perfumes: PerfumeOption[];
  /** Packaging cost per decant size when known (3/5/10…). */
  packagingCostBySize?: Record<number, number | null>;
  defaultValues?: Partial<BundleSetInput>;
};

function blankItem(perfumes: PerfumeOption[]): ItemDraft {
  return { perfume_id: perfumes[0]?.id ?? "", quantity: 1 };
}

function formatPerMl(value: number | null) {
  if (value == null || !(value > 0)) return "—";
  return `${formatMmk(Math.round(value))}/ml`;
}

export function BundleSetForm({
  mode,
  bundleId,
  perfumes,
  packagingCostBySize = {},
  defaultValues,
}: BundleSetFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [sizeMl, setSizeMl] = useState(Number(defaultValues?.size_ml) || 2);
  const [salePrice, setSalePrice] = useState(
    Number(defaultValues?.sale_price_mmk) || 0,
  );
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [isActive, setIsActive] = useState(defaultValues?.is_active ?? true);
  const [items, setItems] = useState<ItemDraft[]>(() =>
    defaultValues?.items?.length
      ? defaultValues.items.map((item) => ({
          perfume_id: item.perfume_id,
          quantity: item.quantity,
        }))
      : [blankItem(perfumes)],
  );
  const [perfumeQuery, setPerfumeQuery] = useState("");

  const selectedIds = useMemo(
    () => new Set(items.map((item) => item.perfume_id).filter(Boolean)),
    [items],
  );

  const suggestions = useMemo(() => {
    const q = perfumeQuery.trim().toLowerCase();
    return perfumes
      .filter((p) => !selectedIds.has(p.id))
      .filter((p) => (q ? p.label.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [perfumes, perfumeQuery, selectedIds]);

  const quote = useMemo(() => {
    const pack = packagingCostBySize[sizeMl];
    return quoteBundleSet({
      sizeMl,
      salePriceMmk: salePrice,
      packagingCostPerUnit: pack,
      items: items
        .filter((item) => item.perfume_id)
        .map((item) => {
          const perfume = perfumes.find((p) => p.id === item.perfume_id);
          return {
            quantity: item.quantity,
            costPerMl: perfume?.cost_per_ml ?? null,
          };
        }),
    });
  }, [items, perfumes, salePrice, sizeMl, packagingCostBySize]);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addPerfume(perfumeId: string) {
    if (!perfumeId || selectedIds.has(perfumeId)) return;
    setItems((prev) => [...prev, { perfume_id: perfumeId, quantity: 1 }]);
    setPerfumeQuery("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const parsed = bundleSetSchema.safeParse({
      name,
      size_ml: sizeMl,
      sale_price_mmk: salePrice,
      notes: notes || null,
      is_active: isActive,
      items: items.filter((item) => item.perfume_id),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      setSaving(false);
      return;
    }

    const result =
      mode === "create"
        ? await createBundleSet(parsed.data)
        : await updateBundleSet(bundleId!, parsed.data);

    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push("/sales/bundles");
    router.refresh();
  }

  if (!perfumes.length) {
    return (
      <p className="border border-[var(--stroke)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        Add perfumes to the catalog before creating a bundle set.{" "}
        <a
          href="/inventory/perfumes/new"
          className="text-[var(--accent)] underline"
        >
          Add perfume
        </a>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <label className="block space-y-1.5">
        <span className={labelClass}>Bundle name</span>
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ladies 2ml discovery set"
          required
        />
      </label>

      <div className="space-y-1.5">
        <span className={labelClass}>Decant size in the set</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BUNDLE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={
                sizeMl === size
                  ? "btn-primary w-full px-2 py-2"
                  : "btn-secondary w-full px-2 py-2"
              }
              onClick={() => setSizeMl(size)}
            >
              {size}ml
            </button>
          ))}
        </div>
        <label className="mt-2 block space-y-1.5">
          <span className={labelClass}>Or type size (ml)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={fieldClass}
            value={sizeMl || ""}
            onChange={(e) => setSizeMl(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Bundle sale price (MMK)</span>
        <input
          type="number"
          min="0"
          step="1"
          className={fieldClass}
          value={salePrice || ""}
          onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
          placeholder="Total for the whole set"
        />
      </label>

      <div className="border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-3">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          Set economics
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--muted)]">Total liquid</p>
            <p className="mt-0.5 tabular-nums">
              {quote.totalMl > 0 ? `${quote.totalMl} ml` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Sell / ml</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatPerMl(quote.pricePerMl)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Est. cost</p>
            <p className="mt-0.5 tabular-nums">
              {quote.cogs != null ? formatMmk(quote.cogs) : "Need stock cost"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Margin</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {quote.margin != null
                ? `${formatMargin(quote.margin)}${
                    quote.profit != null ? ` · ${formatMmk(quote.profit)}` : ""
                  }`
                : "—"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {quote.units > 0 && quote.pricePerUnit != null
            ? `${quote.units} × ${sizeMl}ml · about ${formatMmk(
                Math.round(quote.pricePerUnit),
              )} each. `
            : null}
          Cost uses current liquid WAC
          {packagingCostBySize[sizeMl]
            ? " plus bottle (and tools only if that size is ticked)"
            : " (no bottle cost for this size yet)"}
          . For 2ml sets, leave tools off 2ml under{" "}
          <a href="/sales/price-list" className="underline">
            Sales → Price list → Tools &amp; bottle costs
          </a>
          .
        </p>
      </div>

      <section className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Included perfumes</p>
          <p className="text-xs text-[var(--muted)]">
            {items.length} scent{items.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="space-y-2">
          <input
            className={fieldClass}
            placeholder="Search and add a perfume…"
            value={perfumeQuery}
            onChange={(e) => setPerfumeQuery(e.target.value)}
          />
          {perfumeQuery.trim() && suggestions.length > 0 ? (
            <div className="border border-[var(--stroke)] bg-[var(--canvas)]">
              {suggestions.map((perfume) => (
                <button
                  key={perfume.id}
                  type="button"
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--surface)]"
                  onClick={() => addPerfume(perfume.id)}
                >
                  {perfume.label}
                  {perfume.cost_per_ml != null && perfume.cost_per_ml > 0 ? (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      Cost {formatMmk(perfume.cost_per_ml)}/ml
                      {perfume.ml_on_hand
                        ? ` · ${perfume.ml_on_hand} ml on hand`
                        : ""}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      No liquid cost yet
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {items.map((item, index) => {
          const perfume = perfumes.find((p) => p.id === item.perfume_id);
          const unitCogs =
            perfume?.cost_per_ml != null &&
            perfume.cost_per_ml > 0 &&
            sizeMl > 0
              ? perfume.cost_per_ml * sizeMl +
                (packagingCostBySize[sizeMl] ?? 0)
              : null;
          return (
            <div
              key={`${item.perfume_id}-${index}`}
              className="space-y-2 border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2"
            >
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <p className="text-sm">{perfume?.label ?? "Perfume"}</p>
                <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="w-16 border border-[var(--stroke)] bg-[var(--surface)] px-2 py-1 text-sm tabular-nums"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, {
                        quantity: Math.max(
                          1,
                          Math.trunc(Number(e.target.value) || 1),
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-sm text-[var(--danger)]"
                  onClick={() =>
                    setItems((prev) =>
                      prev.length <= 1
                        ? prev
                        : prev.filter((_, i) => i !== index),
                    )
                  }
                  disabled={items.length <= 1}
                >
                  Remove
                </button>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {unitCogs != null
                  ? `Est. cost ${formatMmk(unitCogs)} per ${sizeMl}ml`
                  : "No stock cost for this scent yet — margin needs a purchase first."}
                {perfume?.ml_on_hand
                  ? ` · ${perfume.ml_on_hand} ml on hand`
                  : ""}
              </p>
            </div>
          );
        })}
      </section>

      <label className="block space-y-1.5">
        <span className={labelClass}>Notes</span>
        <textarea
          className={fieldClass}
          rows={3}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active (available on new sales)
      </label>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button type="submit" className={btnPrimaryClass} disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create bundle" : "Save"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/sales/bundles")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
