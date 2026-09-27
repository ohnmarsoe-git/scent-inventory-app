"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { recordTester } from "@/lib/actions/tester";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import { TESTER_SIZES, type RecordTesterInput } from "@/lib/validations/tester";

export type TesterSource = {
  perfume_id: string;
  label: string;
  quantity_ml: number;
  avg_cost_per_ml: number;
};

type TesterFormProps = {
  sources: TesterSource[];
};

export function TesterForm({ sources }: TesterFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, setValue, formState } =
    useForm<RecordTesterInput>({
      defaultValues: {
        perfume_id: sources[0]?.perfume_id ?? "",
        size_ml: 2,
        quantity: 1,
        notes: "",
      },
    });

  const perfumeId = useWatch({ control, name: "perfume_id" });
  const sizeMl = Number(useWatch({ control, name: "size_ml" })) || 0;
  const quantity = Math.trunc(Number(useWatch({ control, name: "quantity" })) || 0);
  const source = sources.find((item) => item.perfume_id === perfumeId);
  const preview = useMemo(() => {
    const ml = Math.round(sizeMl * Math.max(quantity, 0) * 100) / 100;
    const cost = ml * (source?.avg_cost_per_ml ?? 0);
    const left = (source?.quantity_ml ?? 0) - ml;
    return { ml, cost, left };
  }, [quantity, sizeMl, source]);

  async function onSubmit(values: RecordTesterInput) {
    setServerError(null);
    const result = await recordTester({
      ...values,
      size_ml: Number(values.size_ml),
      quantity: Number(values.quantity),
      notes: values.notes || null,
    });
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.refresh();
  }

  if (!sources.length) {
    return (
      <p className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
        No perfume liquid in stock. Receive a bottle before pouring a tester.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Scent</span>
        <select className={fieldClass} {...register("perfume_id")}>
          {sources.map((item) => (
            <option key={item.perfume_id} value={item.perfume_id}>
              {item.label} · {item.quantity_ml} ml left
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <span className={labelClass}>Size</span>
        <div className="grid grid-cols-2 gap-2">
          {TESTER_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={sizeMl === size ? btnPrimaryClass : btnSecondaryClass}
              onClick={() => setValue("size_ml", size)}
            >
              {size}ml
            </button>
          ))}
        </div>
        <input type="hidden" {...register("size_ml", { valueAsNumber: true })} />
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>How many</span>
        <input
          type="number"
          min="1"
          step="1"
          className={fieldClass}
          {...register("quantity", { valueAsNumber: true })}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Note (optional)</span>
        <input className={fieldClass} placeholder="Customer name" {...register("notes")} />
      </label>

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-3 py-3 text-sm">
        <p className="tabular-nums">
          Uses {preview.ml} ml · cost {formatMmk(preview.cost)}
        </p>
        <p className="mt-1 text-[var(--muted)]">
          {preview.left >= 0
            ? `${Math.round(preview.left * 100) / 100} ml left after this.`
            : "Not enough millilitres."}
        </p>
      </div>

      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        className={btnPrimaryClass}
        disabled={formState.isSubmitting || preview.left < 0 || preview.ml <= 0}
      >
        {formState.isSubmitting ? "Saving…" : "Record tester"}
      </button>
    </form>
  );
}
