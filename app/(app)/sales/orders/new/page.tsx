import { SaleForm } from "@/components/sales/sale-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadCapExtras, loadPackagingCosts } from "@/lib/packaging-costs";
import { perfumeLabel, asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

export default async function NewSalePage() {
  const supabase = await createClient();

  const [
    { data: customers },
    { data: liquid },
    { data: priceEntries },
    bundleResult,
    packaging,
    caps,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inventory_items")
      .select(
        "perfume_id, quantity_on_hand, avg_unit_cost_mmk, perfumes(name, default_bottle_size_ml, brands(name))",
      )
      .eq("item_type", "PERFUME_LIQUID")
      .gt("quantity_on_hand", 0)
      .order("updated_at", { ascending: false }),
    supabase
      .from("price_list_entries")
      .select("perfume_id, size_ml, sell_price_mmk")
      .eq("is_active", true),
    supabase
      .from("bundle_sets")
      .select(
        "id, name, size_ml, sale_price_mmk, bundle_set_items(perfume_id, quantity, sort_order)",
      )
      .eq("is_active", true)
      .order("name"),
    loadPackagingCosts(),
    loadCapExtras(),
  ]);

  const bundleRows = bundleResult.error ? [] : (bundleResult.data ?? []);

  const bottles = (liquid ?? [])
    .filter((row) => row.perfume_id)
    .map((row) => {
      const perfume = asOne(
        row.perfumes as
          | { default_bottle_size_ml?: number }
          | { default_bottle_size_ml?: number }[]
          | null,
      );
      return {
        perfume_id: row.perfume_id as string,
        label: perfumeLabel(row.perfumes),
        ml_on_hand: Number(row.quantity_on_hand),
        cost_per_ml: Number(row.avg_unit_cost_mmk),
        bottle_size_ml: Number(perfume?.default_bottle_size_ml) || 0,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  const prices: Record<string, number> = {};
  for (const entry of priceEntries ?? []) {
    prices[`${entry.perfume_id}:${Number(entry.size_ml)}`] = Number(
      entry.sell_price_mmk,
    );
  }

  const bundles = (bundleRows ?? []).map((bundle) => {
    const items = (
      Array.isArray(bundle.bundle_set_items) ? bundle.bundle_set_items : []
    )
      .slice()
      .sort(
        (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
      )
      .map((item) => ({
        perfume_id: item.perfume_id as string,
        quantity: Number(item.quantity) || 1,
      }));
    return {
      id: bundle.id as string,
      name: bundle.name as string,
      size_ml: Number(bundle.size_ml),
      sale_price_mmk: Number(bundle.sale_price_mmk),
      items,
    };
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New order"
        description="Add scents or a bundle set. Prices come from the market list or the set price."
        backHref="/sales/orders"
        backLabel="Sales"
      />
      <SaleForm
        customers={customers ?? []}
        bottles={bottles}
        prices={prices}
        packaging={packaging}
        caps={caps}
        bundles={bundles}
      />
    </div>
  );
}
