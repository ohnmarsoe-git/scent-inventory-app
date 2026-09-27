"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createBrand, updateBrand } from "@/lib/actions/brands";
import { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from "@/lib/ui";
import { brandSchema, type BrandInput } from "@/lib/validations/masters";

type BrandFormProps = {
  mode: "create" | "edit";
  brandId?: string;
  defaultValues?: Partial<BrandInput>;
};

export function BrandForm({ mode, brandId, defaultValues }: BrandFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BrandInput>({
    defaultValues: {
      name: "",
      notes: "",
      is_active: true,
      ...defaultValues,
    },
  });

  async function onSubmit(values: BrandInput) {
    setServerError(null);
    const parsed = brandSchema.safeParse(values);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createBrand(parsed.data)
        : await updateBrand(brandId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/inventory/brands");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Brand name</span>
        <input className={fieldClass} {...register("name", { required: true })} />
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
              ? "Create brand"
              : "Save changes"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/inventory/brands")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
