"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createPerfume, updatePerfume } from "@/lib/actions/perfumes";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  labelClass,
  PRODUCT_TYPE_LABELS,
} from "@/lib/ui";
import { perfumeSchema, type PerfumeInput } from "@/lib/validations/masters";

type BrandOption = { id: string; name: string };

type PerfumeFormProps = {
  mode: "create" | "edit";
  perfumeId?: string;
  brands: BrandOption[];
  defaultValues?: Partial<PerfumeInput>;
};

export function PerfumeForm({
  mode,
  perfumeId,
  brands,
  defaultValues,
}: PerfumeFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PerfumeInput>({
    defaultValues: {
      brand_id: brands[0]?.id ?? "",
      name: "",
      product_type: "EDP",
      default_bottle_size_ml: 100,
      notes: "",
      is_active: true,
      ...defaultValues,
    },
  });

  async function onSubmit(values: PerfumeInput) {
    setServerError(null);
    const parsed = perfumeSchema.safeParse({
      ...values,
      default_bottle_size_ml: Number(values.default_bottle_size_ml),
    });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    const result =
      mode === "create"
        ? await createPerfume(parsed.data)
        : await updatePerfume(perfumeId!, parsed.data);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    router.push("/inventory/perfumes");
    router.refresh();
  }

  if (brands.length === 0) {
    return (
      <div className="border border-[var(--stroke)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        Add at least one brand before creating a perfume.{" "}
        <a href="/inventory/brands/new" className="text-[var(--accent)] underline">
          Create a brand
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <label className="block space-y-1.5">
        <span className={labelClass}>Brand</span>
        <select className={fieldClass} {...register("brand_id", { required: true })}>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Perfume name</span>
        <input className={fieldClass} {...register("name", { required: true })} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Product type</span>
          <select className={fieldClass} {...register("product_type")}>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Default bottle size (ml)</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className={fieldClass}
            {...register("default_bottle_size_ml", { valueAsNumber: true })}
          />
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
              ? "Create perfume"
              : "Save changes"}
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push("/inventory/perfumes")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
