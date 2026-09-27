import { notFound, redirect } from "next/navigation";

import { ReceiveStockForm } from "@/components/purchasing/receive-stock-form";
import { PageHeader } from "@/components/ui/page-header";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceivePurchaseOrderPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, subtotal_mmk, shipping_cost_mmk, other_cost_mmk, deposit_paid_mmk, purchase_order_items(id, quantity, received_quantity, bottle_size_ml, perfumes(name, brands(name)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  if (order.status !== "ordered" && order.status !== "partially_received") {
    redirect(`/purchasing/orders/${id}`);
  }

  const items = Array.isArray(order.purchase_order_items)
    ? order.purchase_order_items
    : [];

  const lines = items.map((item) => ({
    id: item.id as string,
    perfume_name: perfumeLabel(item.perfumes),
    bottle_size_ml: Number(item.bottle_size_ml),
    quantity: Number(item.quantity),
    received_quantity: Number(item.received_quantity),
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Receive ${order.po_number}`}
        description="Set shipping and other costs, then add the bottles to inventory. Those costs are included in the stock cost."
        backHref={`/purchasing/orders/${id}`}
        backLabel="Back to PO"
      />
      <ReceiveStockForm
        purchaseOrderId={order.id}
        lines={lines}
        subtotalMmk={Number(order.subtotal_mmk)}
        shippingCostMmk={Number(order.shipping_cost_mmk)}
        otherCostMmk={Number(order.other_cost_mmk)}
        paidMmk={Number(order.deposit_paid_mmk ?? 0)}
      />
    </div>
  );
}
