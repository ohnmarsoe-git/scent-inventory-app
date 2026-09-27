"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { createDecant } from "@/lib/actions/decant";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  COMMON_DECANT_SIZES,
  createDecantSchema,
  type CreateDecantInput,
} from "@/lib/validations/decant";

export type LiquidSourceOption = {
  perfume_id: string;
  label: string;
  quantity_ml: number;
  avg_cost_per_ml: number;
};

export type ConsumableOption = {
  id: string;
  name: string;
  cost_per_unit_mmk: number;
  category: string;
};

type DecantFormProps = {
  sources: LiquidSourceOption[];
  consumables: ConsumableOption[];
};

type FormValues = CreateDecantInput;

export function DecantForm({ sources, consumables }: DecantFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      perfume_id: sources[0]?.perfume_id ?? "",
      notes: "",
      outputs: [
        {
          size_ml: 10,
          quantity: 1,
          consumables:
            consumables[0]
              ? [{ consumable_id: consumables[0].id, quantity_per_unit: 1 }]
              : [],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "outputs",
  });

  const watched = useWatch({ control });
  const selectedSource = sources.find((s) => s.perfume_id === watched.perfume_id);

  const preview = useMemo(() => {
    const costPerMl = selectedSource?.avg_cost_per_ml ?? 0;
    const outputs = watched.outputs ?? [];
    let liquidMl = 0;
    const lines = outputs.map((out) => {
      const size = Number(out?.size_ml) || 0;
      const qty = Math.trunc(Number(out?.quantity) || 0);
      const perfumePortion = size * costPerMl;
      let packaging = 0;
      for (const c of out?.consumables ?? []) {
        const cons = consumables.find((x) => x.id === c.consumable_id);
        const perUnit = Number(c?.quantity_per_unit) || 0;
        packaging += perUnit * (cons?.cost_per_unit_mmk ?? 0);
      }
      liquidMl += size * qty;
      return {
        size,
        qty,
        unitCogs: perfumePortion + packaging,
        lineCogs: (perfumePortion + packaging) * qty,
        perfumePortion,
        packaging,
      };
    });
    return {
      liquidMl,
      lines,
      totalCogs: lines.reduce((s, l) => s + l.lineCogs, 0),
      enough: (selectedSource?.quantity_ml ?? 0) >= liquidMl,
    };
  }, [watched, selectedSource, consumables]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const parsed = createDecantSchema.safeParse({
      ...values,
      outputs: values.outputs.map((out) => ({
        size_ml: Number(out.size_ml),
        quantity: Math.trunc(Number(out.quantity)),
        consumables: (out.consumables ?? [])
          .filter((c) => c.consumable_id)
          .map((c) => ({
            consumable_id: c.consumable_id,
            quantity_per_unit: Number(c.quantity_per_unit) || 1,
          })),
      })),
    });

    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result = await createDecant(parsed.data);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push(`/inventory/decants/${result.id}`);
    router.refresh();
  }

  if (sources.length === 0) {
    return (
      <div className="border border-[var(--stroke)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        No perfume liquid stock available.{" "}
        <a href="/purchasing/receiving" className="text-[var(--accent)] underline">
          Receive a purchase
        </a>{" "}
        first.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <section className="space-y-4">
        <label className="block space-y-1.5">
          <span className={labelClass}>Source perfume (liquid)</span>
          <select className={fieldClass} {...register("perfume_id", { required: true })}>
            {sources.map((s) => (
              <option key={s.perfume_id} value={s.perfume_id}>
                {s.label} — {s.quantity_ml} ml @ {formatMmk(s.avg_cost_per_ml)}/ml
              </option>
            ))}
          </select>
        </label>

        {selectedSource ? (
          <div className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm">
            Available:{" "}
            <span className="font-medium tabular-nums">
              {selectedSource.quantity_ml} ml
            </span>
            <span className="mx-2 text-[var(--stroke)]">·</span>
            Cost:{" "}
            <span className="tabular-nums">
              {formatMmk(selectedSource.avg_cost_per_ml)}/ml
            </span>
          </div>
        ) : null}

        <label className="block space-y-1.5">
          <span className={labelClass}>Notes</span>
          <textarea className={`${fieldClass} min-h-20`} {...register("notes")} />
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Decant outputs
          </h2>
          <button
            type="button"
            className={btnSecondaryClass}
            onClick={() =>
              append({
                size_ml: 5,
                quantity: 1,
                consumables: [],
              })
            }
          >
            Add size
          </button>
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Output {index + 1}</p>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={labelClass}>Size (ml)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  list={`decant-sizes-${index}`}
                  className={fieldClass}
                  {...register(`outputs.${index}.size_ml`, {
                    valueAsNumber: true,
                  })}
                />
                <datalist id={`decant-sizes-${index}`}>
                  {COMMON_DECANT_SIZES.map((size) => (
                    <option key={size} value={size} />
                  ))}
                </datalist>
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>Quantity (units)</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  className={fieldClass}
                  {...register(`outputs.${index}.quantity`, {
                    setValueAs: (v) => {
                      const n = Number(v);
                      return Number.isFinite(n) ? Math.trunc(n) : 0;
                    },
                  })}
                />
              </label>
            </div>

            <ConsumableFields
              outputIndex={index}
              consumables={consumables}
              control={control}
              register={register}
            />

            {preview.lines[index] ? (
              <p className="text-xs text-[var(--muted)]">
                Est. unit COGS{" "}
                <span className="tabular-nums text-[var(--ink)]">
                  {formatMmk(preview.lines[index].unitCogs)}
                </span>{" "}
                (perfume {formatMmk(preview.lines[index].perfumePortion)} + packaging{" "}
                {formatMmk(preview.lines[index].packaging)})
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <span className="text-[var(--muted)]">Liquid to use</span>
          <span
            className={`tabular-nums font-medium ${
              preview.enough ? "" : "text-[var(--danger)]"
            }`}
          >
            {preview.liquidMl} ml
            {!preview.enough ? " (not enough stock)" : ""}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-[var(--stroke)] pt-3">
          <span className="text-[var(--muted)]">Est. total COGS</span>
          <span className="tabular-nums font-medium">
            {formatMmk(preview.totalCogs)}
          </span>
        </div>
      </section>

      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={btnPrimaryClass}
          disabled={!preview.enough || preview.liquidMl <= 0}
        >
          Create decant
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/inventory/decants")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

type ConsumableFieldsProps = {
  outputIndex: number;
  consumables: ConsumableOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
};

function ConsumableFields({
  outputIndex,
  consumables,
  control,
  register,
}: ConsumableFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `outputs.${outputIndex}.consumables`,
  });

  if (consumables.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        No consumables yet — packaging cost will be perfume-only.{" "}
        <a href="/inventory/consumables/new" className="underline">
          Add packaging
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={labelClass}>Packaging per unit</span>
        <button
          type="button"
          className="text-xs text-[var(--accent)] underline"
          onClick={() =>
            append({
              consumable_id: consumables[0].id,
              quantity_per_unit: 1,
            })
          }
        >
          Add packaging
        </button>
      </div>
      {fields.map((field, cIndex) => (
        <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
          <select
            className={fieldClass}
            {...register(
              `outputs.${outputIndex}.consumables.${cIndex}.consumable_id`,
            )}
          >
            {consumables.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({formatMmk(c.cost_per_unit_mmk)})
              </option>
            ))}
          </select>
          <input
            type="number"
            step="1"
            min="0.01"
            className={fieldClass}
            title="Qty per decant unit"
            {...register(
              `outputs.${outputIndex}.consumables.${cIndex}.quantity_per_unit`,
              { valueAsNumber: true },
            )}
          />
          <button
            type="button"
            className="text-sm text-[var(--danger)]"
            onClick={() => remove(cIndex)}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
