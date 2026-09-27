import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setConsumableActive } from "@/lib/actions/consumables";
import { liveUnitCost } from "@/lib/domain/pricing";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function ConsumablesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  let query = supabase
    .from("consumables")
    .select(
      "id, name, category, unit, purchase_price_mmk, quantity_purchased, cost_per_unit_mmk, is_active, suppliers(name)",
    )
    .order("name");

  if (!showArchived) query = query.eq("is_active", true);
  if (q) {
    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);
  }

  const [{ data: consumables, error }, { data: stock }] = await Promise.all([
    query,
    supabase
      .from("inventory_items")
      .select("consumable_id, quantity_on_hand, avg_unit_cost_mmk")
      .eq("item_type", "CONSUMABLE"),
  ]);

  const stockById = new Map(
    (stock ?? [])
      .filter((row) => row.consumable_id)
      .map((row) => [row.consumable_id as string, row]),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Consumables"
        description="Bottles, boxes, and other materials. Margin uses the cost shown here."
        actionHref="/inventory/consumables/new"
        actionLabel="Add consumable"
        backHref="/inventory"
        backLabel="Inventory"
      />

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search consumables…" />
      </Suspense>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !consumables?.length ? (
        <EmptyState
          title="No consumables yet"
          description="Add packaging items so decant COGS can include bottle and label costs."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Cost now</th>
                  <th className="px-4 py-3 font-medium">On hand</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {consumables.map((item) => {
                  const onHand = stockById.get(item.id);
                  const cost = liveUnitCost(
                    Number(item.cost_per_unit_mmk),
                    onHand ? Number(onHand.avg_unit_cost_mmk) : null,
                  );
                  const qty = onHand
                    ? Number(onHand.quantity_on_hand)
                    : null;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatMmk(cost)} / {item.unit}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {qty == null ? "—" : qty}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={item.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/inventory/consumables/${item.id}/edit`}
                            className={btnSecondaryClass}
                          >
                            Edit
                          </Link>
                          <ArchiveToggleButton
                            id={item.id}
                            active={item.is_active}
                            action={setConsumableActive}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {consumables.map((item) => {
              const onHand = stockById.get(item.id);
              const cost = liveUnitCost(
                Number(item.cost_per_unit_mmk),
                onHand ? Number(onHand.avg_unit_cost_mmk) : null,
              );
              const qty = onHand ? Number(onHand.quantity_on_hand) : null;
              return (
              <div
                key={item.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.category} · {formatMmk(cost)} / {item.unit}
                      {qty == null ? "" : ` · ${qty} on hand`}
                    </p>
                  </div>
                  <StatusPill active={item.is_active} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/inventory/consumables/${item.id}/edit`}
                    className={btnSecondaryClass}
                  >
                    Edit
                  </Link>
                  <ArchiveToggleButton
                    id={item.id}
                    active={item.is_active}
                    action={setConsumableActive}
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
