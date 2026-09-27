import { DecantForm } from "@/components/decant/decant-form";
import { PageHeader } from "@/components/ui/page-header";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

export default async function NewDecantPage() {
  const supabase = await createClient();

  const [{ data: liquidItems }, { data: consumables }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "perfume_id, quantity_on_hand, avg_unit_cost_mmk, perfumes(name, brands(name))",
      )
      .eq("item_type", "PERFUME_LIQUID")
      .gt("quantity_on_hand", 0)
      .order("updated_at", { ascending: false }),
    supabase
      .from("consumables")
      .select("id, name, category, cost_per_unit_mmk")
      .eq("is_active", true)
      .order("name"),
  ]);

  const sources = (liquidItems ?? [])
    .filter((item) => item.perfume_id)
    .map((item) => ({
      perfume_id: item.perfume_id as string,
      label: perfumeLabel(item.perfumes),
      quantity_ml: Number(item.quantity_on_hand),
      avg_cost_per_ml: Number(item.avg_unit_cost_mmk),
    }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New decant"
        description="Deducts liquid ml, creates decant units, and calculates COGS (perfume + packaging)."
        backHref="/inventory/decants"
        backLabel="Decants"
      />
      <DecantForm
        sources={sources}
        consumables={(consumables ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          cost_per_unit_mmk: Number(c.cost_per_unit_mmk),
        }))}
      />
    </div>
  );
}
