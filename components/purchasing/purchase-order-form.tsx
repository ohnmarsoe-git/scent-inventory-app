"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";

import {
  createPurchaseOrder,
  updateDraftPurchaseOrder,
} from "@/lib/actions/purchasing";
import { moneyLeft } from "@/lib/domain/preorder";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  purchaseOrderSchema,
  type PurchaseOrderInput,
} from "@/lib/validations/purchasing";

type Option = { id: string; name: string; default_bottle_size_ml?: number };

type PurchaseOrderFormProps = {
  mode: "create" | "edit";
  poId?: string;
  suppliers: Option[];
  perfumes: Option[];
  defaultValues?: Partial<PurchaseOrderInput>;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseOrderForm({
  mode,
  poId,
  suppliers,
  perfumes,
  defaultValues,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setValue } = useForm<PurchaseOrderInput>({
    defaultValues: {
      supplier_id: suppliers[0]?.id ?? "",
      order_date: todayIso(),
      expected_arrival_date: "",
      currency: "MMK",
      exchange_rate: 1,
      shipping_cost_original: 0,
      other_cost_original: 0,
      deposit_paid_mmk: 0,
      notes: "",
      lines: [
        {
          perfume_id: perfumes[0]?.id ?? "",
          bottle_size_ml: perfumes[0]?.default_bottle_size_ml ?? 100,
          quantity: 1,
          unit_cost_original: 0,
          notes: "",
        },
      ],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watched = useWatch({ control });

  const totals = useMemo(() => {
    const rate = Number(watched.exchange_rate) || 0;
    const shipping = Number(watched.shipping_cost_original) || 0;
    const other = Number(watched.other_cost_original) || 0;
    const lines = watched.lines ?? [];
    const subtotal = lines.reduce((sum, line) => {
      const qty = Number(line?.quantity) || 0;
      const unit = Number(line?.unit_cost_original) || 0;
      return sum + qty * unit;
    }, 0);
    const totalOriginal = subtotal + shipping + other;
    return {
      subtotal,
      totalOriginal,
      totalMmk: totalOriginal * rate,
    };
  }, [watched]);

  function onPerfumeChange(index: number, perfumeId: string) {
    const perfume = perfumes.find((p) => p.id === perfumeId);
    setValue(`lines.${index}.perfume_id`, perfumeId);
    if (perfume?.default_bottle_size_ml) {
      setValue(`lines.${index}.bottle_size_ml`, perfume.default_bottle_size_ml);
    }
  }

  async function onSubmit(values: PurchaseOrderInput) {
    setServerError(null);
    const parsed = purchaseOrderSchema.safeParse({
      ...values,
      exchange_rate: Number(values.exchange_rate),
      shipping_cost_original: Number(values.shipping_cost_original) || 0,
      other_cost_original: Number(values.other_cost_original) || 0,
      deposit_paid_mmk: Number(values.deposit_paid_mmk) || 0,
      expected_arrival_date: values.expected_arrival_date || null,
      lines: values.lines.map((line) => ({
        ...line,
        bottle_size_ml: Number(line.bottle_size_ml),
        quantity: Math.trunc(Number(line.quantity)),
        unit_cost_original: Number(line.unit_cost_original),
      })),
    });

    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createPurchaseOrder(parsed.data)
        : await updateDraftPurchaseOrder(poId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    router.push(`/purchasing/orders/${result.id}`);
    router.refresh();
  }

  if (suppliers.length === 0) {
    return (
      <div className="border border-[var(--stroke)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        Add a supplier first.{" "}
        <a href="/purchasing/suppliers/new" className="underline text-[var(--accent)]">
          Create supplier
        </a>
      </div>
    );
  }

  if (perfumes.length === 0) {
    return (
      <div className="border border-[var(--stroke)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        Add perfumes first.{" "}
        <a href="/inventory/perfumes/new" className="underline text-[var(--accent)]">
          Create perfume
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <section className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className={labelClass}>Supplier</span>
          <select className={fieldClass} {...register("supplier_id", { required: true })}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>Order date</span>
          <input type="date" className={fieldClass} {...register("order_date")} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Expected arrival</span>
          <input
            type="date"
            className={fieldClass}
            {...register("expected_arrival_date")}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>Currency</span>
          <select className={fieldClass} {...register("currency")}>
            <option value="MMK">MMK</option>
            <option value="USD">USD</option>
            <option value="THB">THB</option>
            <option value="SGD">SGD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Exchange rate → MMK</span>
          <input
            type="number"
            step="0.0001"
            min="0.0001"
            className={fieldClass}
            {...register("exchange_rate", { valueAsNumber: true })}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={labelClass}>Shipping cost (original)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className={fieldClass}
            {...register("shipping_cost_original", { valueAsNumber: true })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Other costs (original)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className={fieldClass}
            {...register("other_cost_original", { valueAsNumber: true })}
          />
        </label>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>Paid now (MMK)</span>
            <input
              type="number"
              step="1"
              min="0"
              className={fieldClass}
              {...register("deposit_paid_mmk", { valueAsNumber: true })}
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Nothing, 30%, half, or the full amount. This is money already
            invested in the bottle, not an expense.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: "Nothing", share: 0 },
              { label: "30%", share: 0.3 },
              { label: "Half", share: 0.5 },
              { label: "Paid in full", share: 1 },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className={btnSecondaryClass}
                onClick={() =>
                  setValue(
                    "deposit_paid_mmk",
                    Math.round(totals.totalMmk * option.share),
                    { shouldDirty: true },
                  )
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className={labelClass}>Notes</span>
          <textarea className={`${fieldClass} min-h-20`} {...register("notes")} />
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Line items
          </h2>
          <button
            type="button"
            className={btnSecondaryClass}
            onClick={() =>
              append({
                perfume_id: perfumes[0].id,
                bottle_size_ml: perfumes[0].default_bottle_size_ml ?? 100,
                quantity: 1,
                unit_cost_original: 0,
                notes: "",
              })
            }
          >
            Add line
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--ink)]">
                  Line {index + 1}
                </p>
                {fields.length > 1 ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--danger)]"
                    onClick={() => remove(index)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <label className="block space-y-1.5">
                <span className={labelClass}>Perfume</span>
                <select
                  className={fieldClass}
                  {...register(`lines.${index}.perfume_id`)}
                  onChange={(e) => onPerfumeChange(index, e.target.value)}
                >
                  {perfumes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className={labelClass}>Bottle size (ml)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={fieldClass}
                    {...register(`lines.${index}.bottle_size_ml`, {
                      valueAsNumber: true,
                    })}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={labelClass}>Qty (bottles)</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    inputMode="numeric"
                    className={fieldClass}
                    {...register(`lines.${index}.quantity`, {
                      setValueAs: (v) => {
                        const n = Number(v);
                        return Number.isFinite(n) ? Math.trunc(n) : 0;
                      },
                    })}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={labelClass}>Unit cost (original)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={fieldClass}
                    {...register(`lines.${index}.unit_cost_original`, {
                      valueAsNumber: true,
                    })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <span className="text-[var(--muted)]">Subtotal (original)</span>
          <span className="tabular-nums">{totals.subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <span className="text-[var(--muted)]">Total (original)</span>
          <span className="tabular-nums font-medium">
            {totals.totalOriginal.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-[var(--stroke)] pt-3">
          <span className="text-[var(--muted)]">Estimated total (MMK)</span>
          <span className="tabular-nums font-medium">
            {formatMmk(totals.totalMmk)}
          </span>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <span className="text-[var(--muted)]">Paid now</span>
          <span className="tabular-nums">
            {formatMmk(Number(watched.deposit_paid_mmk) || 0)}
          </span>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <span className="text-[var(--muted)]">Left to pay</span>
          <span className="tabular-nums font-medium">
            {formatMmk(
              moneyLeft(totals.totalMmk, Number(watched.deposit_paid_mmk) || 0),
            )}
          </span>
        </div>
      </section>

      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={btnPrimaryClass}>
          {mode === "create" ? "Create draft PO" : "Save draft"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/purchasing/orders")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
