import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setPerfumeActive } from "@/lib/actions/perfumes";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, PRODUCT_TYPE_LABELS } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function PerfumesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  let query = supabase
    .from("perfumes")
    .select(
      "id, name, product_type, default_bottle_size_ml, notes, is_active, brands(name)",
    )
    .order("name");

  if (!showArchived) query = query.eq("is_active", true);
  if (q) {
    query = query.or(`name.ilike.%${q}%`);
  }

  const { data: perfumes, error } = await query;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Perfumes"
        description="Catalog of fragrances. Cost comes from purchases, not this screen."
        actionHref="/inventory/perfumes/new"
        actionLabel="Add perfume"
        backHref="/inventory"
        backLabel="Inventory"
      />

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search perfumes…" />
      </Suspense>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !perfumes?.length ? (
        <EmptyState
          title="No perfumes yet"
          description="Create brands first, then add perfume catalog items."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Perfume</th>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Bottle</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {perfumes.map((perfume) => {
                  const brandName =
                    perfume.brands &&
                    typeof perfume.brands === "object" &&
                    "name" in perfume.brands
                      ? String(perfume.brands.name)
                      : "—";
                  return (
                    <tr
                      key={perfume.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{perfume.name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {brandName}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {PRODUCT_TYPE_LABELS[perfume.product_type] ??
                          perfume.product_type}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {Number(perfume.default_bottle_size_ml)} ml
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={perfume.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/inventory/perfumes/${perfume.id}/edit`}
                            className={btnSecondaryClass}
                          >
                            Edit
                          </Link>
                          <ArchiveToggleButton
                            id={perfume.id}
                            active={perfume.is_active}
                            action={setPerfumeActive}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {perfumes.map((perfume) => {
              const brandName =
                perfume.brands &&
                typeof perfume.brands === "object" &&
                "name" in perfume.brands
                  ? String(perfume.brands.name)
                  : "—";
              return (
                <div
                  key={perfume.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{perfume.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {brandName} ·{" "}
                        {PRODUCT_TYPE_LABELS[perfume.product_type] ??
                          perfume.product_type}{" "}
                        · {Number(perfume.default_bottle_size_ml)} ml
                      </p>
                    </div>
                    <StatusPill active={perfume.is_active} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/inventory/perfumes/${perfume.id}/edit`}
                      className={btnSecondaryClass}
                    >
                      Edit
                    </Link>
                    <ArchiveToggleButton
                      id={perfume.id}
                      active={perfume.is_active}
                      action={setPerfumeActive}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
