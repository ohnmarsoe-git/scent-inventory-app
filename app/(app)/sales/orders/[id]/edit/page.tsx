import { notFound } from "next/navigation";

import { SaleForm } from "@/components/sales/sale-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadCapExtras, loadPackagingCosts } from "@/lib/packaging-costs";
import { perfumeLabel, asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSalePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: sale },
    { data: customers },
    { data: liquid },
    { data: priceEntries },
    bundleResult,
    packaging,
    caps,
  ] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, sale_number, sale_date, customer_id, discount_mmk, notes, is_voided, customers(name), sale_items(perfume_id, size_ml, quantity, unit_sale_price_mmk, line_discount_mmk, description)",
      )
      .eq("id", id)
      .maybeSingle(),
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

  if (!sale || sale.is_voided) notFound();

  const items = Array.isArray(sale.sale_items) ? sale.sale_items : [];
  const reservedMl = new Map<string, number>();
  for (const item of items) {
    const perfumeId = item.perfume_id as string | null;
    if (!perfumeId) continue;
    const ml =
      (Number(item.size_ml) || 0) * (Number(item.quantity) || 0);
    reservedMl.set(perfumeId, (reservedMl.get(perfumeId) ?? 0) + ml);
  }

  const bottles = (liquid ?? [])
    .filter((row) => row.perfume_id)
    .map((row) => {
      const perfumeId = row.perfume_id as string;
      const perfume = asOne(
        row.perfumes as
          | { default_bottle_size_ml?: number }
          | { default_bottle_size_ml?: number }[]
          | null,
      );
      const onHand =
        Number(row.quantity_on_hand) + (reservedMl.get(perfumeId) ?? 0);
      return {
        perfume_id: perfumeId,
        label: perfumeLabel(row.perfumes),
        ml_on_hand: Math.round(onHand * 100) / 100,
        cost_per_ml: Number(row.avg_unit_cost_mmk),
        bottle_size_ml: Number(perfume?.default_bottle_size_ml) || 0,
      };
    })
    .filter(
      (row) =>
        row.ml_on_hand > 0 || reservedMl.has(row.perfume_id),
    );

  // Ensure sale lines still appear even if liquid row was missing somehow.
  for (const item of items) {
    const perfumeId = item.perfume_id as string | null;
    if (!perfumeId) continue;
    if (bottles.some((b) => b.perfume_id === perfumeId)) continue;
    bottles.push({
      perfume_id: perfumeId,
      label: String(item.description || "Perfume"),
      ml_on_hand: reservedMl.get(perfumeId) ?? 0,
      cost_per_ml: 0,
      bottle_size_ml: 0,
    });
  }

  const prices: Record<string, number> = {};
  for (const entry of priceEntries ?? []) {
    prices[`${entry.perfume_id}:${Number(entry.size_ml)}`] = Number(
      entry.sell_price_mmk,
    );
  }

  const bundleRows = bundleResult.error ? [] : (bundleResult.data ?? []);
  const bundles = (bundleRows ?? []).map((bundle) => {
    const bundleItems = (
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
      items: bundleItems,
    };
  });

  const customer = asOne(sale.customers as { name?: string } | null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Edit ${sale.sale_number}`}
        description="Change lines, item discounts, or the order discount. Stock is adjusted when you save."
        backHref={`/sales/orders/${id}`}
        backLabel="Sale"
      />
      <SaleForm
        mode="edit"
        saleId={id}
        customers={customers ?? []}
        bottles={bottles}
        prices={prices}
        packaging={packaging}
        caps={caps}
        bundles={bundles}
        initialCustomerId={sale.customer_id}
        initialCustomerName={customer?.name ?? ""}
        initialSaleDate={sale.sale_date}
        initialDiscountMmk={Number(sale.discount_mmk) || 0}
        initialNotes={sale.notes}
        initialLines={items
          .filter((item) => item.perfume_id)
          .map((item) => ({
            perfume_id: item.perfume_id as string,
            size_ml: Number(item.size_ml) || 0,
            quantity: Number(item.quantity) || 1,
            unit_sale_price_mmk: Number(item.unit_sale_price_mmk) || 0,
            line_discount_mmk: Number(item.line_discount_mmk) || 0,
            with_cap: String(item.description || "").includes("· cap"),
          }))}
      />
    </div>
  );
}
