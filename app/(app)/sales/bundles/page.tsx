import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setBundleSetActive } from "@/lib/actions/bundles";
import { loadBundlePerfumeOptions } from "@/lib/bundle-costs";
import { quoteBundleSet } from "@/lib/domain/bundles";
import { formatMargin } from "@/lib/domain/pricing";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function BundleSetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  let query = supabase
    .from("bundle_sets")
    .select(
      "id, name, size_ml, sale_price_mmk, notes, is_active, bundle_set_items(perfume_id, quantity)",
    )
    .order("name");

  if (!showArchived) query = query.eq("is_active", true);
  if (q) query = query.ilike("name", `%${q}%`);

  const [{ data: bundles, error }, { perfumes, packagingCostBySize }] =
    await Promise.all([query, loadBundlePerfumeOptions()]);

  const missingTable =
    error?.message?.includes("bundle_sets") ||
    error?.message?.includes("schema cache");

  const costByPerfume = new Map(
    perfumes.map((p) => [p.id, p.cost_per_ml] as const),
  );

  function economics(bundle: {
    size_ml: number;
    sale_price_mmk: number;
    bundle_set_items: unknown;
  }) {
    const items = (
      Array.isArray(bundle.bundle_set_items) ? bundle.bundle_set_items : []
    ).map((item) => ({
      quantity: Number(
        (item as { quantity?: number }).quantity,
      ) || 1,
      costPerMl:
        costByPerfume.get(
          (item as { perfume_id?: string }).perfume_id as string,
        ) ?? null,
    }));
    return quoteBundleSet({
      sizeMl: Number(bundle.size_ml),
      salePriceMmk: Number(bundle.sale_price_mmk),
      packagingCostPerUnit: packagingCostBySize[Number(bundle.size_ml)],
      items,
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Bundle sets"
        description="Discovery kits (2ml / 3ml / …). Sell/ml and margin use current liquid cost."
        actionHref="/sales/bundles/new"
        actionLabel="Add bundle"
        backHref="/sales"
        backLabel="Sales"
      />

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search bundles…" />
      </Suspense>

      {missingTable ? (
        <p className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          Bundle tables are not in the database yet. In Supabase SQL Editor, run{" "}
          <code className="text-[var(--ink)]">
            supabase/migrations/20261031150000_bundle_sets.sql
          </code>
          , then refresh.
        </p>
      ) : error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !bundles?.length ? (
        <EmptyState
          title="No bundle sets yet"
          description="Create a set with a size (e.g. 2ml), included perfumes, and one sale price."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Bundle</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Scents</th>
                  <th className="px-4 py-3 font-medium">Sale price</th>
                  <th className="px-4 py-3 font-medium">Sell / ml</th>
                  <th className="px-4 py-3 font-medium">Margin</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => {
                  const scentCount = Array.isArray(bundle.bundle_set_items)
                    ? bundle.bundle_set_items.length
                    : 0;
                  const quote = economics(bundle);
                  return (
                    <tr
                      key={bundle.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{bundle.name}</td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {Number(bundle.size_ml)} ml
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {scentCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMmk(Number(bundle.sale_price_mmk))}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {quote.pricePerMl != null
                          ? `${formatMmk(Math.round(quote.pricePerMl))}/ml`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMargin(quote.margin)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={bundle.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/sales/bundles/${bundle.id}/edit`}
                            className={btnSecondaryClass}
                          >
                            Edit
                          </Link>
                          <ArchiveToggleButton
                            id={bundle.id}
                            active={bundle.is_active}
                            action={setBundleSetActive}
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
            {bundles.map((bundle) => {
              const scentCount = Array.isArray(bundle.bundle_set_items)
                ? bundle.bundle_set_items.length
                : 0;
              const quote = economics(bundle);
              return (
                <div
                  key={bundle.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{bundle.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {Number(bundle.size_ml)} ml · {scentCount} scents ·{" "}
                        {formatMmk(Number(bundle.sale_price_mmk))}
                      </p>
                      <p className="mt-1 text-sm tabular-nums">
                        {quote.pricePerMl != null
                          ? `${formatMmk(Math.round(quote.pricePerMl))}/ml`
                          : "—"}
                        {" · "}
                        Margin {formatMargin(quote.margin)}
                      </p>
                    </div>
                    <StatusPill active={bundle.is_active} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/sales/bundles/${bundle.id}/edit`}
                      className={btnSecondaryClass}
                    >
                      Edit
                    </Link>
                    <ArchiveToggleButton
                      id={bundle.id}
                      active={bundle.is_active}
                      action={setBundleSetActive}
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
