"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { receiveConsumableStock } from "@/lib/actions/consumables";
import { btnPrimaryClass, fieldClass, formatMmk, labelClass } from "@/lib/ui";

type ReceiptValues = {
  quantity: number;
  total_mmk: number;
};

type ConsumableReceiptFormProps = {
  consumableId: string;
  openingQty: number;
  openingCost: number;
};

export function ConsumableReceiptForm({
  consumableId,
  openingQty,
  openingCost,
}: ConsumableReceiptFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, control, reset, formState } = useForm<ReceiptValues>({
    defaultValues: { quantity: 0, total_mmk: 0 },
  });
  const quantity = Number(useWatch({ control, name: "quantity" })) || 0;
  const total = Number(useWatch({ control, name: "total_mmk" })) || 0;
  const preview = useMemo(() => {
    if (quantity <= 0) return null;
    const unit = total / quantity;
    const nextQty = openingQty + quantity;
    const nextAvg =
      nextQty > 0 ? (openingQty * openingCost + quantity * unit) / nextQty : unit;
    return { unit, nextAvg, nextQty };
  }, [openingCost, openingQty, quantity, total]);

  async function onSubmit(values: ReceiptValues) {
    setServerError(null);
    const result = await receiveConsumableStock(consumableId, {
      quantity: Number(values.quantity),
      total_mmk: Number(values.total_mmk),
    });
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    reset({ quantity: 0, total_mmk: 0 });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 border border-[var(--stroke)] bg-[var(--surface)] p-4"
    >
      <div>
        <p className="font-medium">Buy more</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Same item. Do not archive it. On hand {openingQty} · cost now{" "}
          {formatMmk(openingCost)}. This buy is averaged with what is left, and
          the decant margin uses that new cost.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Quantity bought</span>
          <input
            type="number"
            min="1"
            step="1"
            className={fieldClass}
            {...register("quantity", { valueAsNumber: true })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Total paid (MMK)</span>
          <input
            type="number"
            min="0"
            step="1"
            className={fieldClass}
            {...register("total_mmk", { valueAsNumber: true })}
          />
        </label>
      </div>
      {preview ? (
        <p className="text-sm tabular-nums">
          {formatMmk(preview.unit)} each · new average {formatMmk(preview.nextAvg)} ·
          on hand {preview.nextQty}
        </p>
      ) : null}
      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}
      <button type="submit" disabled={formState.isSubmitting} className={btnPrimaryClass}>
        {formState.isSubmitting ? "Saving…" : "Add this buy"}
      </button>
    </form>
  );
}
