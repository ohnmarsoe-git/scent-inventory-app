"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { recordPayment } from "@/lib/actions/sales";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  PAYMENT_METHOD_LABELS,
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/lib/validations/sales";

type PaymentFormProps = {
  saleId: string;
  remainingAmount: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentForm({ saleId, remainingAmount }: PaymentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<RecordPaymentInput>({
    defaultValues: {
      sale_id: saleId,
      amount_mmk: Math.max(remainingAmount, 0),
      payment_method: "cash",
      payment_date: todayIso(),
      notes: "",
    },
  });

  async function onSubmit(values: RecordPaymentInput) {
    setServerError(null);
    const parsed = recordPaymentSchema.safeParse({
      ...values,
      amount_mmk: Number(values.amount_mmk),
      notes: values.notes || null,
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid payment");
      return;
    }
    if (parsed.data.amount_mmk > remainingAmount + 0.001) {
      setServerError("Payment cannot be more than the amount still owed.");
      return;
    }
    startTransition(async () => {
      const result = await recordPayment(parsed.data);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Remaining:{" "}
        <span className="font-medium tabular-nums text-[var(--ink)]">
          {formatMmk(remainingAmount)}
        </span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Amount (MMK)</span>
          <input
            type="number"
            min="1"
            max={remainingAmount}
            step="1"
            className={fieldClass}
            {...register("amount_mmk", { valueAsNumber: true })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Method</span>
          <select className={fieldClass} {...register("payment_method")}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Date</span>
          <input type="date" className={fieldClass} {...register("payment_date")} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Notes</span>
          <input className={fieldClass} {...register("notes")} />
        </label>
      </div>
      <input type="hidden" {...register("sale_id")} />
      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}
      <button type="submit" className={btnPrimaryClass} disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </button>
      <button
        type="button"
        className={`${btnSecondaryClass} ml-2`}
        onClick={() => router.refresh()}
      >
        Reset
      </button>
    </form>
  );
}
