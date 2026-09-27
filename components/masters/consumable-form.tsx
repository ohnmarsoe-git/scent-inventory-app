"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { createConsumable, updateConsumable } from "@/lib/actions/consumables";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  CONSUMABLE_CATEGORIES,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  consumableFormSchema,
  type ConsumableFormInput,
} from "@/lib/validations/masters";

type SupplierOption = { id: string; name: string };

type ConsumableFormProps = {
  mode: "create" | "edit";
  consumableId?: string;
  suppliers: SupplierOption[];
  defaultValues?: Partial<ConsumableFormInput>;
};

export function ConsumableForm({
  mode,
  consumableId,
  suppliers,
  defaultValues,
}: ConsumableFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<ConsumableFormInput>({
    defaultValues: {
      name: "",
      category: "Bottle",
      unit: "each",
      purchase_price_mmk: 0,
      quantity_purchased: 0,
      notes: "",
      is_active: true,
      ...defaultValues,
      supplier_id: defaultValues?.supplier_id ?? "",
    },
  });

  const price = useWatch({ control, name: "purchase_price_mmk" });
  const qty = useWatch({ control, name: "quantity_purchased" });
  const unitCost = useMemo(() => {
    const p = Number(price) || 0;
    const q = Number(qty) || 0;
    return q > 0 ? p / q : 0;
  }, [price, qty]);

  async function onSubmit(values: ConsumableFormInput) {
    setServerError(null);
    const parsed = consumableFormSchema.safeParse({
      ...values,
      purchase_price_mmk: Number(values.purchase_price_mmk),
      quantity_purchased: Number(values.quantity_purchased),
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createConsumable(parsed.data)
        : await updateConsumable(consumableId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/inventory/consumables");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Name</span>
        <input
          className={fieldClass}
          placeholder="e.g. 10ml bottle"
          {...register("name", { required: true })}
        />
        <span className="text-xs text-[var(--muted)]">
          A decant bottle needs the size in the name, such as 10ml bottle.
          Tools such as a syringe are not added to every decant until you tick
          them on the price list.
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Category</span>
          <select className={fieldClass} {...register("category")}>
            {CONSUMABLE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Unit</span>
          <select className={fieldClass} {...register("unit")}>
            <option value="each">Each</option>
            <option value="ml">ml</option>
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Purchase price (MMK)</span>
          <input
            type="number"
            step="1"
            min="0"
            className={fieldClass}
            {...register("purchase_price_mmk", { valueAsNumber: true })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Quantity purchased</span>
          <input
            type="number"
            step="1"
            min="0"
            className={fieldClass}
            {...register("quantity_purchased", { valueAsNumber: true })}
          />
        </label>
      </div>

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-3 py-3 text-sm">
        <span className="text-[var(--muted)]">Cost per unit: </span>
        <span className="font-medium tabular-nums text-[var(--ink)]">
          {formatMmk(unitCost)}
        </span>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Purchase price divided by quantity. Saving writes this into stock,
          which is the cost the price list uses.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Supplier (optional)</span>
        <select className={fieldClass} {...register("supplier_id")}>
          <option value="">— None —</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Notes</span>
        <textarea className={`${fieldClass} min-h-24`} {...register("notes")} />
      </label>

      <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
        <input type="checkbox" {...register("is_active")} />
        Active
      </label>

      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isSubmitting} className={btnPrimaryClass}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create consumable"
              : "Save changes"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/inventory/consumables")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
