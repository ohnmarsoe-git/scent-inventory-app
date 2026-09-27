import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setBrandActive } from "@/lib/actions/brands";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function BrandsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  let query = supabase
    .from("brands")
    .select("id, name, notes, is_active, created_at")
    .order("name");

  if (!showArchived) {
    query = query.eq("is_active", true);
  }
  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data: brands, error } = await query;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Brands"
        description="Perfume brand catalog."
        actionHref="/inventory/brands/new"
        actionLabel="Add brand"
        backHref="/inventory"
        backLabel="Inventory"
      />

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search brands…" />
      </Suspense>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !brands?.length ? (
        <EmptyState
          title="No brands yet"
          description="Add brands like Burberry, Chanel, or Dior before creating perfumes."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr
                    key={brand.id}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--ink)]">
                      {brand.name}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-[var(--muted)]">
                      {brand.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill active={brand.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/inventory/brands/${brand.id}/edit`}
                          className={btnSecondaryClass}
                        >
                          Edit
                        </Link>
                        <ArchiveToggleButton
                          id={brand.id}
                          active={brand.is_active}
                          action={setBrandActive}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--ink)]">{brand.name}</p>
                    {brand.notes ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {brand.notes}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill active={brand.is_active} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/inventory/brands/${brand.id}/edit`}
                    className={btnSecondaryClass}
                  >
                    Edit
                  </Link>
                  <ArchiveToggleButton
                    id={brand.id}
                    active={brand.is_active}
                    action={setBrandActive}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
