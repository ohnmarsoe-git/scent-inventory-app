"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from "@/lib/ui";
import { customerSchema, type CustomerInput } from "@/lib/validations/sales";

type CustomerFormProps = {
  mode: "create" | "edit";
  customerId?: string;
  defaultValues?: Partial<CustomerInput>;
};

export function CustomerForm({
  mode,
  customerId,
  defaultValues,
}: CustomerFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CustomerInput>({
    defaultValues: {
      name: "",
      phone: "",
      messenger_contact: "",
      notes: "",
      is_active: true,
      ...defaultValues,
    },
  });

  async function onSubmit(values: CustomerInput) {
    setServerError(null);
    const parsed = customerSchema.safeParse({
      ...values,
      phone: values.phone || null,
      messenger_contact: values.messenger_contact || null,
      notes: values.notes || null,
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createCustomer(parsed.data)
        : await updateCustomer(customerId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/sales/customers");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Customer name</span>
        <input className={fieldClass} {...register("name", { required: true })} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Phone</span>
          <input className={fieldClass} {...register("phone")} />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Messenger / contact</span>
          <input className={fieldClass} {...register("messenger_contact")} />
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
              ? "Create customer"
              : "Save changes"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/sales/customers")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
