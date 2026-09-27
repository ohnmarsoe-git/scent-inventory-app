import { SaleForm } from "@/components/sales/sale-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadCapExtras, loadPackagingCosts } from "@/lib/packaging-costs";
import { perfumeLabel, asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

export default async function NewSalePage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: liquid }, { data: priceEntries }, packaging, caps] =
    await Promise.all([
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
      loadPackagingCosts(),
      loadCapExtras(),
    ]);

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
    });

  const prices: Record<string, number> = {};
  for (const entry of priceEntries ?? []) {
    prices[`${entry.perfume_id}:${Number(entry.size_ml)}`] = Number(
      entry.sell_price_mmk,
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader
        title="New order"
        description="Pick a scent and size. The sell price is the market price to quote."
        backHref="/sales/orders"
        backLabel="Sales"
      />
      <SaleForm
        customers={customers ?? []}
        bottles={bottles}
        prices={prices}
        packaging={packaging}
        caps={caps}
      />
    </div>
  );
}
