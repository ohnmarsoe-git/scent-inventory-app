import { packagingCostForSize } from "@/lib/domain/pricing";
import { loadPackagingCosts } from "@/lib/packaging-costs";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

export type BundlePerfumeOption = {
  id: string;
  label: string;
  cost_per_ml: number | null;
  ml_on_hand: number;
};

/** Active perfumes plus current liquid cost/on-hand for bundle quotes. */
export async function loadBundlePerfumeOptions(): Promise<{
  perfumes: BundlePerfumeOption[];
  packagingCostBySize: Record<number, number | null>;
}> {
  const supabase = await createClient();
  const [{ data: perfumes }, { data: liquid }, packaging] = await Promise.all([
    supabase
      .from("perfumes")
      .select("id, name, brands(name)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inventory_items")
      .select("perfume_id, quantity_on_hand, avg_unit_cost_mmk")
      .eq("item_type", "PERFUME_LIQUID"),
    loadPackagingCosts(),
  ]);

  const byPerfume = new Map<
    string,
    { cost_per_ml: number; ml_on_hand: number }
  >();
  for (const row of liquid ?? []) {
    if (!row.perfume_id) continue;
    byPerfume.set(row.perfume_id, {
      cost_per_ml: Number(row.avg_unit_cost_mmk) || 0,
      ml_on_hand: Number(row.quantity_on_hand) || 0,
    });
  }

  const options = (perfumes ?? []).map((perfume) => {
    const stock = byPerfume.get(perfume.id);
    return {
      id: perfume.id,
      label: perfumeLabel(perfume),
      cost_per_ml:
        stock && stock.cost_per_ml > 0 ? stock.cost_per_ml : null,
      ml_on_hand: stock?.ml_on_hand ?? 0,
    };
  });

  const packagingCostBySize: Record<number, number | null> = {};
  for (const size of [2, 3, 5, 10, 20, 30] as const) {
    packagingCostBySize[size] = packagingCostForSize(packaging, size);
  }

  return { perfumes: options, packagingCostBySize };
}
