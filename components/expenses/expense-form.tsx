"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createExpense, updateExpense } from "@/lib/actions/expenses";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  labelClass,
} from "@/lib/ui";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/sales";
import { expenseSchema, type ExpenseInput } from "@/lib/validations/expenses";

type Option = { id: string; name: string };

type ExpenseFormProps = {
  mode: "create" | "edit";
  expenseId?: string;
  categories: Option[];
  purchaseOrders: Option[];
  defaultValues?: Partial<ExpenseInput>;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({
  mode,
  expenseId,
  categories,
  purchaseOrders,
  defaultValues,
}: ExpenseFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ExpenseInput>({
    defaultValues: {
      expense_date: todayIso(),
      category_id: categories[0]?.id ?? "",
      description: "",
      amount_mmk: 0,
      payment_method: "cash",
      related_purchase_order_id: "",
      notes: "",
      ...defaultValues,
    },
  });

  async function onSubmit(values: ExpenseInput) {
    setServerError(null);
    const parsed = expenseSchema.safeParse({
      ...values,
      amount_mmk: Number(values.amount_mmk),
      related_purchase_order_id: values.related_purchase_order_id || null,
      notes: values.notes || null,
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createExpense(parsed.data)
        : await updateExpense(expenseId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/expenses");
    router.refresh();
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-[var(--danger)]">
        No expense categories found. Re-run the initial schema migration.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Date</span>
        <input type="date" className={fieldClass} {...register("expense_date")} />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Category</span>
        <select className={fieldClass} {...register("category_id", { required: true })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Description</span>
        <input
          className={fieldClass}
          {...register("description", { required: true })}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Amount (MMK)</span>
          <input
            type="number"
            min="1"
            step="1"
            className={fieldClass}
            {...register("amount_mmk", { valueAsNumber: true })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Payment method</span>
          <select className={fieldClass} {...register("payment_method")}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Related purchase (optional)</span>
        <select className={fieldClass} {...register("related_purchase_order_id")}>
          <option value="">— None —</option>
          {purchaseOrders.map((po) => (
            <option key={po.id} value={po.id}>
              {po.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Notes</span>
        <textarea className={`${fieldClass} min-h-20`} {...register("notes")} />
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
              ? "Create expense"
              : "Save changes"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/expenses")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
