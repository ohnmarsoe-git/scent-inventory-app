"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";
import { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from "@/lib/ui";
import { supplierSchema, type SupplierInput } from "@/lib/validations/masters";

type SupplierFormProps = {
  mode: "create" | "edit";
  supplierId?: string;
  defaultValues?: Partial<SupplierInput>;
};

export function SupplierForm({
  mode,
  supplierId,
  defaultValues,
}: SupplierFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SupplierInput>({
    defaultValues: {
      name: "",
      phone: "",
      contact: "",
      notes: "",
      is_active: true,
      ...defaultValues,
    },
  });

  async function onSubmit(values: SupplierInput) {
    setServerError(null);
    const parsed = supplierSchema.safeParse(values);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createSupplier(parsed.data)
        : await updateSupplier(supplierId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/purchasing/suppliers");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Supplier name</span>
        <input className={fieldClass} {...register("name", { required: true })} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Phone</span>
          <input className={fieldClass} {...register("phone")} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Contact / Messenger</span>
          <input className={fieldClass} {...register("contact")} />
        </label>
      </div>

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
              ? "Create supplier"
              : "Save changes"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/purchasing/suppliers")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
