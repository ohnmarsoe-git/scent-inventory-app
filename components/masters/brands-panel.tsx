"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteBrand,
  setBrandActive,
  updateBrand,
} from "@/lib/actions/brands";
import { btnPrimaryClass, btnSecondaryClass, fieldClass, labelClass } from "@/lib/ui";

export type BrandRow = {
  id: string;
  name: string;
  is_active: boolean;
  perfume_count: number;
};

type Props = {
  brands: BrandRow[];
};

export function BrandsPanel({ brands }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!brands.length) return null;

  function startRename(brand: BrandRow) {
    setEditingId(brand.id);
    setEditName(brand.name);
    setError(null);
  }

  function run(
    action: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <section className="border border-[var(--stroke)] bg-[var(--surface)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Brands · {brands.length}
        </span>
        <span className="text-sm text-[var(--muted)]">
          {open ? "Hide" : "Manage"}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[var(--stroke)] px-4 py-4">
          <p className="text-sm text-[var(--muted)]">
            Rename, archive, or delete brands. Delete only works when a brand
            has no perfumes.
          </p>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="flex flex-wrap items-center gap-2 border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5"
              >
                {editingId === brand.id ? (
                  <>
                    <label className="min-w-[12rem] flex-1 space-y-1">
                      <span className={labelClass}>Name</span>
                      <input
                        className={fieldClass}
                        value={editName}
                        disabled={pending}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className={btnPrimaryClass}
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          updateBrand(brand.id, {
                            name: editName.trim(),
                            notes: null,
                            is_active: brand.is_active,
                          }),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={btnSecondaryClass}
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{brand.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {brand.perfume_count} perfume
                        {brand.perfume_count === 1 ? "" : "s"}
                        {!brand.is_active ? " · archived" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={btnSecondaryClass}
                      disabled={pending}
                      onClick={() => startRename(brand)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className={btnSecondaryClass}
                      disabled={pending}
                      onClick={() =>
                        run(() => setBrandActive(brand.id, !brand.is_active))
                      }
                    >
                      {brand.is_active ? "Archive" : "Restore"}
                    </button>
                    <button
                      type="button"
                      className={btnSecondaryClass}
                      disabled={pending || brand.perfume_count > 0}
                      title={
                        brand.perfume_count > 0
                          ? "Remove or reassign perfumes first"
                          : "Delete brand"
                      }
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete brand “${brand.name}”? This cannot be undone.`,
                          )
                        ) {
                          return;
                        }
                        run(() => deleteBrand(brand.id));
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
