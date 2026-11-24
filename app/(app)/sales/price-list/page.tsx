import { PriceListWorkspace } from "@/components/sales/price-list-workspace";
import { PageHeader } from "@/components/ui/page-header";
import {
  showsOnDecantPriceList,
  showsOnSealedPriceList,
  type PerfumeSellChannel,
} from "@/lib/domain/pricing";
import { loadPriceListCostSetup } from "@/lib/packaging-costs";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

function asSellChannel(value: unknown): PerfumeSellChannel {
  if (value === "DECANT" || value === "SEALED" || value === "BOTH") {
    return value;
  }
  return "BOTH";
}

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function PriceListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab === "full" ? "full" : "decant";
  const supabase = await createClient();

  const [
    { data: perfumes, error: perfumeError },
    { data: entries, error },
    { data: liquid },
  ] = await Promise.all([
    supabase
      .from("perfumes")
      .select("id, name, default_bottle_size_ml, sell_channel, brands(name)")
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

  const stockByPerfume = new Map<string, number>();
  const costByPerfume = new Map<string, { weight: number; value: number }>();
  for (const row of liquid ?? []) {
    if (!row.perfume_id) continue;
    const qty = Number(row.quantity_on_hand);
    const stockQty = Number.isFinite(qty) ? Math.max(qty, 0) : 0;
    stockByPerfume.set(
      row.perfume_id,
      (stockByPerfume.get(row.perfume_id) ?? 0) + stockQty,
    );
    const cost = Number(row.avg_unit_cost_mmk);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    const weight = stockQty > 0 ? stockQty : 1;
    const prev = costByPerfume.get(row.perfume_id) ?? { weight: 0, value: 0 };
    costByPerfume.set(row.perfume_id, {
      weight: prev.weight + weight,
      value: prev.value + weight * cost,
    });
  }

  const perfumeRows = (perfumes ?? [])
    .map((p) => {
      const cost = costByPerfume.get(p.id as string);
      const sellChannel = asSellChannel(
        (p as { sell_channel?: unknown }).sell_channel,
      );
      return {
        id: p.id as string,
        label: perfumeLabel(p),
        costPerMl: cost && cost.weight > 0 ? cost.value / cost.weight : 0,
        quantityMl: stockByPerfume.get(p.id as string) ?? 0,
        bottleSizeMl: Number(p.default_bottle_size_ml) || 0,
        sellChannel,
      };
    })
    .filter((p) => showsOnDecantPriceList(p.sellChannel));

  const fullSizeRows = (perfumes ?? [])
    .map((p) => {
      const cost = costByPerfume.get(p.id as string);
      const sellChannel = asSellChannel(
        (p as { sell_channel?: unknown }).sell_channel,
      );
      return {
        id: p.id as string,
        label: perfumeLabel(p),
        costPerMl: cost && cost.weight > 0 ? cost.value / cost.weight : 0,
        quantityMl: stockByPerfume.get(p.id as string) ?? 0,
        bottleSizeMl: Number(p.default_bottle_size_ml) || 0,
        sellChannel,
      };
    })
    .filter((p) => showsOnSealedPriceList(p.sellChannel));

  const initialPrices: Record<string, number> = {};
  for (const entry of entries ?? []) {
    const key = `${entry.perfume_id}:${Number(entry.size_ml)}`;
    initialPrices[key] = Number(entry.sell_price_mmk);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Price list"
        description={
          tab === "full"
            ? "Scents set to Sealed / mini or Both on the perfume. Change under Inventory → Perfumes."
            : "Scents set to Decant pour or Both on the perfume. Change under Inventory → Perfumes."
        }
        backHref="/sales"
        backLabel="Sales"
        actionHref="/sales/orders/new"
        actionLabel="New sale"
      />

      {perfumeError || error || costError || !costSetup ? (
        <p className="text-sm text-[var(--danger)]">
          {perfumeError?.message || error?.message || costError}
        </p>
      ) : (
        <PriceListWorkspace
          tab={tab}
          perfumes={perfumeRows}
          fullSizePerfumes={fullSizeRows}
          initialPrices={initialPrices}
          tools={costSetup.tools}
          initialToolIds={costSetup.selectedToolIds}
          initialToolSizes={costSetup.toolSizes}
          initialBottles={costSetup.bottles}
          stockBottles={costSetup.stockBottles}
          caps={costSetup.caps}
          capItems={costSetup.capItems}
        />
      )}
    </div>
  );
}
