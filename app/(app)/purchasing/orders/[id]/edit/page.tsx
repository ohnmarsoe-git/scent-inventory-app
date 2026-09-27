import { notFound, redirect } from "next/navigation";

import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPurchaseOrderPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: suppliers }, { data: perfumes }] =
    await Promise.all([
      supabase
        .from("purchase_orders")
        .select("*, purchase_order_items(*)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("perfumes")
        .select("id, name, default_bottle_size_ml, brands(name)")
        .eq("is_active", true)
        .order("name"),
    ]);

  if (!order) notFound();
  if (order.status !== "draft") {
    redirect(`/purchasing/orders/${id}`);
  }

  const items = Array.isArray(order.purchase_order_items)
    ? order.purchase_order_items
    : [];

  const perfumeOptions = (perfumes ?? []).map((p) => {
    const brand =
      p.brands && typeof p.brands === "object" && "name" in p.brands
        ? String(p.brands.name)
        : "";
    return {
      id: p.id,
      name: brand ? `${brand} — ${p.name}` : p.name,
      default_bottle_size_ml: Number(p.default_bottle_size_ml),
    };
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Edit ${order.po_number}`}
        description="Draft only — totals recalculate on save."
        backHref={`/purchasing/orders/${id}`}
        backLabel="Back to PO"
      />
      <PurchaseOrderForm
        mode="edit"
        poId={order.id}
        suppliers={suppliers ?? []}
        perfumes={perfumeOptions}
        defaultValues={{
          supplier_id: order.supplier_id,
          order_date: order.order_date,
          expected_arrival_date: order.expected_arrival_date ?? "",
          currency: order.currency,
          exchange_rate: Number(order.exchange_rate),
          shipping_cost_original: Number(order.shipping_cost_original),
          other_cost_original: Number(order.other_cost_original),
          deposit_paid_mmk: Number(order.deposit_paid_mmk ?? 0),
          notes: order.notes ?? "",
          lines: items.map(
            (item: {
              perfume_id: string;
              bottle_size_ml: number;
              quantity: number;
              unit_cost_original: number;
              notes: string | null;
            }) => ({
              perfume_id: item.perfume_id,
              bottle_size_ml: Number(item.bottle_size_ml),
              quantity: Number(item.quantity),
              unit_cost_original: Number(item.unit_cost_original),
              notes: item.notes ?? "",
            }),
          ),
        }}
      />
    </div>
  );
}
