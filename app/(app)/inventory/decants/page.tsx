import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { parsePageParam } from "@/lib/pagination";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function DecantsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { page, from, to } = parsePageParam(params.page);
  const supabase = await createClient();
  const { data: rows, error, count } = await supabase
    .from("decant_transactions")
    .select(
      "id, decant_number, liquid_ml_used, liquid_total_cost_mmk, created_at, notes, perfumes(name, brands(name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  const total = count ?? 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Decants"
        description="Convert perfume liquid into sellable decant units with automatic COGS."
        actionHref="/inventory/decants/new"
        actionLabel="New decant"
        backHref="/inventory"
        backLabel="Inventory"
      />

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !rows?.length ? (
        <EmptyState
          title="No decants yet"
          description="Create a decant from liquid stock to produce 3ml / 5ml / 10ml units."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Decant #</th>
                  <th className="px-4 py-3 font-medium">Perfume</th>
                  <th className="px-4 py-3 font-medium">Liquid used</th>
                  <th className="px-4 py-3 font-medium">Liquid cost</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{row.decant_number}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {perfumeLabel(row.perfumes)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {Number(row.liquid_ml_used)} ml
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {formatMmk(Number(row.liquid_total_cost_mmk))}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/decants/${row.id}`}
                        className={btnSecondaryClass}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/inventory/decants/${row.id}`}
                className="block border border-[var(--stroke)] bg-[var(--surface)] p-4"
              >
                <p className="font-medium">{row.decant_number}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {perfumeLabel(row.perfumes)} · {Number(row.liquid_ml_used)} ml
                </p>
                <p className="mt-1 text-sm tabular-nums">
                  {formatMmk(Number(row.liquid_total_cost_mmk))}
                </p>
              </Link>
            ))}
          </div>
          <Suspense fallback={null}>
            <PaginationBar total={total} page={page} />
          </Suspense>
        </>
      )}
    </div>
  );
}
