"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  deleteBrand,
  setBrandActive,
  updateBrand,
} from "@/lib/actions/brands";
import { createPerfume, updatePerfume } from "@/lib/actions/perfumes";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  labelClass,
  PRODUCT_TYPE_LABELS,
} from "@/lib/ui";
import { perfumeSchema, type PerfumeInput } from "@/lib/validations/masters";

export type BrandOption = { id: string; name: string; is_active?: boolean };

type PerfumeFormValues = PerfumeInput & { brand_name: string };

type PerfumeFormProps = {
  mode: "create" | "edit";
  perfumeId?: string;
  brands: BrandOption[];
  defaultValues?: Partial<PerfumeInput> & { brand_name?: string };
};

export function PerfumeForm({
  mode,
  perfumeId,
  brands: initialBrands,
  defaultValues,
}: PerfumeFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [brands, setBrands] = useState(initialBrands);
  const [brandQuery, setBrandQuery] = useState(
    defaultValues?.brand_name ??
      brands.find((b) => b.id === defaultValues?.brand_id)?.name ??
      "",
  );
  const [brandId, setBrandId] = useState(defaultValues?.brand_id ?? "");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [brandBusy, setBrandBusy] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<PerfumeFormValues>({
    defaultValues: {
      brand_id: defaultValues?.brand_id ?? "",
      brand_name:
        defaultValues?.brand_name ??
        brands.find((b) => b.id === defaultValues?.brand_id)?.name ??
        "",
      name: "",
      product_type: "EDP",
      default_bottle_size_ml: 100,
      notes: "",
      is_active: true,
      ...defaultValues,
    },
  });

  const suggestions = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    const list = q
      ? brands.filter((b) => b.name.toLowerCase().includes(q))
      : brands;
    return list.slice(0, 8);
  }, [brandQuery, brands]);

  const selectedBrand = brands.find((b) => b.id === brandId) ?? null;

  function pickBrand(brand: BrandOption) {
    setBrandId(brand.id);
    setBrandQuery(brand.name);
    setValue("brand_id", brand.id);
    setValue("brand_name", brand.name);
    setOpenSuggest(false);
    setRenameOpen(false);
  }

  async function onSubmit(values: PerfumeFormValues) {
    setServerError(null);
    const parsed = perfumeSchema.safeParse({
      ...values,
      brand_id: brandId || null,
      brand_name: brandQuery.trim(),
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

  async function saveRename() {
    if (!selectedBrand) return;
    const name = renameValue.trim();
    if (!name) {
      setServerError("Brand name is required.");
      return;
    }
    setBrandBusy(true);
    setServerError(null);
    const result = await updateBrand(selectedBrand.id, {
      name,
      notes: null,
      is_active: selectedBrand.is_active !== false,
    });
    setBrandBusy(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setBrands((prev) =>
      prev.map((b) => (b.id === selectedBrand.id ? { ...b, name } : b)),
    );
    setBrandQuery(name);
    setValue("brand_name", name);
    setRenameOpen(false);
    router.refresh();
  }

  async function archiveSelected() {
    if (!selectedBrand) return;
    if (
      !window.confirm(
        `Archive brand “${selectedBrand.name}”? Active perfumes under it must be archived first.`,
      )
    ) {
      return;
    }
    setBrandBusy(true);
    setServerError(null);
    const result = await setBrandActive(selectedBrand.id, false);
    setBrandBusy(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setBrands((prev) => prev.filter((b) => b.id !== selectedBrand.id));
    setBrandId("");
    setBrandQuery("");
    setValue("brand_id", "");
    setValue("brand_name", "");
    router.refresh();
  }

  async function deleteSelected() {
    if (!selectedBrand) return;
    if (
      !window.confirm(
        `Delete brand “${selectedBrand.name}”? Only allowed if it has no perfumes.`,
      )
    ) {
      return;
    }
    setBrandBusy(true);
    setServerError(null);
    const result = await deleteBrand(selectedBrand.id);
    setBrandBusy(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setBrands((prev) => prev.filter((b) => b.id !== selectedBrand.id));
    setBrandId("");
    setBrandQuery("");
    setValue("brand_id", "");
    setValue("brand_name", "");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-5">
      <div className="space-y-1.5">
        <span className={labelClass}>Brand</span>
        <div className="relative">
          <input
            className={fieldClass}
            placeholder="Type a brand, or pick one"
            autoComplete="off"
            value={brandQuery}
            onChange={(e) => {
              const value = e.target.value;
              setBrandQuery(value);
              setBrandId("");
              setValue("brand_id", "");
              setValue("brand_name", value);
              setOpenSuggest(true);
              setRenameOpen(false);
            }}
            onFocus={() => setOpenSuggest(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpenSuggest(false), 150);
            }}
          />
          {openSuggest && (suggestions.length > 0 || brandQuery.trim()) ? (
            <div className="absolute z-20 mt-1 w-full border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_12px_28px_rgba(20,22,26,0.08)]">
              {suggestions.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--canvas)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickBrand(brand)}
                >
                  {brand.name}
                </button>
              ))}
              {brandQuery.trim() &&
              !suggestions.some(
                (b) =>
                  b.name.toLowerCase() === brandQuery.trim().toLowerCase(),
              ) ? (
                <p className="border-t border-[var(--stroke)] px-3 py-2 text-xs text-[var(--muted)]">
                  New brand “{brandQuery.trim()}” will be created with this
                  perfume.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {selectedBrand ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!renameOpen ? (
              <>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  disabled={brandBusy}
                  onClick={() => {
                    setRenameValue(selectedBrand.name);
                    setRenameOpen(true);
                  }}
                >
                  Rename brand
                </button>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  disabled={brandBusy}
                  onClick={archiveSelected}
                >
                  Archive brand
                </button>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  disabled={brandBusy}
                  onClick={deleteSelected}
                >
                  Delete brand
                </button>
              </>
            ) : (
              <div className="flex w-full flex-wrap items-end gap-2">
                <label className="min-w-[12rem] flex-1 space-y-1.5">
                  <span className={labelClass}>New brand name</span>
                  <input
                    className={fieldClass}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={btnPrimaryClass}
                  disabled={brandBusy}
                  onClick={saveRename}
                >
                  Save name
                </button>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  disabled={brandBusy}
                  onClick={() => setRenameOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

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
        <button type="submit" disabled={isSubmitting || brandBusy} className={btnPrimaryClass}>
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
