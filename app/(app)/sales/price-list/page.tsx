import { PriceListEditor } from "@/components/sales/price-list-editor";
import { PageHeader } from "@/components/ui/page-header";
import { loadPriceListCostSetup } from "@/lib/packaging-costs";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

export default async function PriceListPage() {
  const supabase = await createClient();

  const [
    { data: perfumes, error: perfumeError },
    { data: entries, error },
    { data: liquid },
  ] = await Promise.all([
    supabase
      .from("perfumes")
      .select("id, name, brands(name)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("price_list_entries")
      .select("perfume_id, size_ml, sell_price_mmk")
      .eq("is_active", true),
    supabase
      .from("inventory_items")
      .select("perfume_id, quantity_on_hand, avg_unit_cost_mmk")
      .eq("item_type", "PERFUME_LIQUID"),
  ]);

  let costSetup: Awaited<ReturnType<typeof loadPriceListCostSetup>> | null =
    null;
  let costError: string | null = null;
  try {
    costSetup = await loadPriceListCostSetup();
  } catch (loadError) {
    const message =
      loadError instanceof Error ? loadError.message : "Could not load costs.";
    costError = message.includes("normal_bottle_mmk")
      ? "Cost settings are not in the database yet. In the Supabase SQL editor, run supabase/migrations/20260920250000_price_list_cost_basis.sql, then reload."
      : message;
  }

  const costByPerfume = new Map<string, { weight: number; value: number }>();
  for (const row of liquid ?? []) {
    if (!row.perfume_id) continue;
    const qty = Number(row.quantity_on_hand);
    const cost = Number(row.avg_unit_cost_mmk);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const weight = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const prev = costByPerfume.get(row.perfume_id) ?? { weight: 0, value: 0 };
    costByPerfume.set(row.perfume_id, {
      weight: prev.weight + weight,
      value: prev.value + weight * cost,
    });
  }

  const perfumeRows = (perfumes ?? []).map((p) => {
    const cost = costByPerfume.get(p.id as string);
    return {
      id: p.id as string,
      label: perfumeLabel(p),
      costPerMl: cost && cost.weight > 0 ? cost.value / cost.weight : 0,
    };
  });

  const initialPrices: Record<string, number> = {};
  for (const entry of entries ?? []) {
    const key = `${entry.perfume_id}:${Number(entry.size_ml)}`;
    initialPrices[key] = Number(entry.sell_price_mmk);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Price list"
        description="Market sell price and margin for each decant size."
        backHref="/sales"
        backLabel="Sales"
        actionHref="/sales/orders/new"
        actionLabel="New sale"
      />

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
        Filled from Pricing Strategy II (3 · 5 · 10 · 20 · 30ml). The percent
        uses the sale price, perfume cost, the normal bottle for that ml, and
        only the tools you tick. Edit a cell when this scent should differ,
        then save.
      </div>

      {perfumeError || error || costError || !costSetup ? (
        <p className="text-sm text-[var(--danger)]">
          {perfumeError?.message || error?.message || costError}
        </p>
      ) : (
        <PriceListEditor
          perfumes={perfumeRows}
          initialPrices={initialPrices}
          tools={costSetup.tools}
          initialToolIds={costSetup.selectedToolIds}
          initialBottles={costSetup.bottles}
          stockBottles={costSetup.stockBottles}
        />
      )}
    </div>
  );
}
