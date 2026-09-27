import { notFound } from "next/navigation";

import { ConsumableForm } from "@/components/masters/consumable-form";
import { ConsumableReceiptForm } from "@/components/masters/consumable-receipt-form";
import { PageHeader } from "@/components/ui/page-header";
import { liveUnitCost } from "@/lib/domain/pricing";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditConsumablePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: consumable }, { data: suppliers }, { data: stock }] =
    await Promise.all([
    supabase
      .from("consumables")
      .select(
        "id, name, category, unit, purchase_price_mmk, quantity_purchased, cost_per_unit_mmk, supplier_id, notes, is_active",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inventory_items")
      .select("quantity_on_hand, avg_unit_cost_mmk")
      .eq("item_type", "CONSUMABLE")
      .eq("consumable_id", id)
      .maybeSingle(),
  ]);

  if (!consumable) notFound();

  const supplierOptions = suppliers ?? [];
  if (
    consumable.supplier_id &&
    !supplierOptions.some((s) => s.id === consumable.supplier_id)
  ) {
    const { data: current } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("id", consumable.supplier_id)
      .maybeSingle();
    if (current) supplierOptions.unshift(current);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit consumable"
        description={consumable.name}
        backHref="/inventory/consumables"
        backLabel="Consumables"
      />
      <ConsumableReceiptForm
        consumableId={consumable.id}
        openingQty={
          stock ? Number(stock.quantity_on_hand) : Number(consumable.quantity_purchased)
        }
        openingCost={liveUnitCost(
          Number(consumable.cost_per_unit_mmk),
          stock ? Number(stock.avg_unit_cost_mmk) : null,
        )}
      />
      <ConsumableForm
        mode="edit"
        consumableId={consumable.id}
        suppliers={supplierOptions}
        defaultValues={{
          name: consumable.name,
          category: consumable.category,
          unit: consumable.unit,
          purchase_price_mmk: Number(consumable.purchase_price_mmk),
          quantity_purchased: Number(consumable.quantity_purchased),
          supplier_id: consumable.supplier_id ?? "",
          notes: consumable.notes ?? "",
          is_active: consumable.is_active,
        }}
      />
    </div>
  );
}
