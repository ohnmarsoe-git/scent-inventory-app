import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { BrandsPanel } from "@/components/masters/brands-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setPerfumeActive } from "@/lib/actions/perfumes";
import { parsePageParam } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import {
  btnSecondaryClass,
  PRODUCT_TYPE_LABELS,
  SELL_CHANNEL_LABELS,
} from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string; page?: string }>;
};

export default async function PerfumesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";
  const { page, from, to } = parsePageParam(params.page);

  const supabase = await createClient();

  let matchedIds: string[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    let byNameQuery = supabase
      .from("perfumes")
      .select("id")
      .ilike("name", pattern);
    let byBrandQuery = supabase
      .from("perfumes")
      .select("id, brands!inner(name)")
      .ilike("brands.name", pattern);
    // Active list vs archived-only list — keep search in the same bucket.
    byNameQuery = showArchived
      ? byNameQuery.eq("is_active", false)
      : byNameQuery.eq("is_active", true);
    byBrandQuery = showArchived
      ? byBrandQuery.eq("is_active", false)
      : byBrandQuery.eq("is_active", true);

    const [byName, byBrand] = await Promise.all([byNameQuery, byBrandQuery]);
    matchedIds = [
      ...new Set(
        [
          ...(byName.data ?? []).map((row) => row.id),
          ...(byBrand.data ?? []).map((row) => row.id),
        ].filter(Boolean),
      ),
    ];
  }

  let query = supabase
    .from("perfumes")
    .select(
      "id, name, product_type, sell_channel, default_bottle_size_ml, notes, is_active, brands(name)",
      { count: "exact" },
    )
    .order("name");

  // Default: active only. Show archived: archived only (not mixed with active).
  query = showArchived
    ? query.eq("is_active", false)
    : query.eq("is_active", true);
  if (matchedIds) {
    if (!matchedIds.length) {
      return (
        <PerfumesShell showArchived={showArchived}>
          <EmptyState
            title={
              showArchived
                ? "No matching archived perfumes"
                : "No matching perfumes"
            }
            description="Try another perfume or brand name."
          />
        </PerfumesShell>
      );
    }
    query = query.in("id", matchedIds);
  }

  const [{ data: perfumes, error, count }, { data: brands }] = await Promise.all([
    query.range(from, to),
    supabase
      .from("brands")
      .select("id, name, is_active, perfumes(count)")
      .order("name"),
  ]);
  const total = count ?? 0;

  const brandRows = (brands ?? []).map((brand) => {
    const countRel = brand.perfumes as { count?: number }[] | { count?: number } | null;
    const count = Array.isArray(countRel)
      ? Number(countRel[0]?.count ?? 0)
      : Number(countRel?.count ?? 0);
    return {
      id: brand.id as string,
      name: brand.name as string,
      is_active: Boolean(brand.is_active),
      perfume_count: count,
    };
  });

  return (
    <PerfumesShell showArchived={showArchived}>
      <BrandsPanel brands={brandRows} />

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !perfumes?.length ? (
        <EmptyState
          title={showArchived ? "No archived perfumes" : "No perfumes yet"}
          description={
            showArchived
              ? "Archived scents will appear here. Uncheck Archived only to see the active catalog."
              : "Add a perfume and type a brand name — a new brand is created automatically if needed."
          }
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
                  <th className="px-4 py-3 font-medium">Price list</th>
                  <th className="px-4 py-3 font-medium">Sealed bottle</th>
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
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {SELL_CHANNEL_LABELS[
                          (perfume as { sell_channel?: string }).sell_channel ??
                            "BOTH"
                        ] ?? "Both"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        Sealed {Number(perfume.default_bottle_size_ml)} ml
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
                        ·{" "}
                        {SELL_CHANNEL_LABELS[
                          (perfume as { sell_channel?: string }).sell_channel ??
                            "BOTH"
                        ] ?? "Both"}{" "}
                        · Sealed {Number(perfume.default_bottle_size_ml)} ml
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
          <Suspense fallback={null}>
            <PaginationBar total={total} page={page} />
          </Suspense>
        </>
      )}
    </PerfumesShell>
  );
}

function PerfumesShell({
  children,
  showArchived = false,
}: {
  children: React.ReactNode;
  showArchived?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Perfumes"
        description={
          showArchived
            ? "Archived scents only. Restore one to put it back on the active catalog and price lists."
            : "Fragrance catalog with brands. Type a new brand when adding a perfume — no separate Brands page."
        }
        actionHref="/inventory/perfumes/new"
        actionLabel="Add perfume"
        backHref="/inventory"
        backLabel="Inventory"
      />

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search perfume or brand…" />
      </Suspense>

      {children}
    </div>
  );
}
