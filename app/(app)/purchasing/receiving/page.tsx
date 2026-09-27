import Link from "next/link";

import { PoStatusPill } from "@/components/purchasing/po-status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { btnPrimaryClass, btnSecondaryClass, formatMmk } from "@/lib/ui";

function itemNames(items: unknown, qtyKey: "quantity" | "quantity_bottles"): string {
  const lines = Array.isArray(items) ? items : [];
  if (!lines.length) return "—";
  return lines
    .map((line) => {
      const row = line as {
        perfumes?: unknown;
        bottle_size_ml?: number | string | null;
        quantity?: number | string | null;
        quantity_bottles?: number | string | null;
      };
      const name = perfumeLabel(row.perfumes);
      const size = Number(row.bottle_size_ml);
      const qty = Number(row[qtyKey]);
      const sizePart = Number.isFinite(size) && size > 0 ? `${size} ml` : "";
      const qtyPart = Number.isFinite(qty) && qty > 1 ? `× ${qty}` : "";
      return [name, sizePart, qtyPart].filter(Boolean).join(" ");
    })
    .join(", ");
}

export default async function ReceivingHubPage() {
  const supabase = await createClient();

  const [{ data: openOrders }, { data: recentReceipts }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, po_number, order_date, status, total_mmk, suppliers(name), purchase_order_items(quantity, bottle_size_ml, perfumes(name, brands(name)))",
      )
      .in("status", ["ordered", "partially_received"])
      .order("order_date", { ascending: true }),
    supabase
      .from("purchase_receipts")
      .select(
        "id, receipt_number, received_at, notes, purchase_orders(po_number), purchase_receipt_items(quantity_bottles, bottle_size_ml, perfumes(name, brands(name)))",
      )
      .order("received_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Receiving"
        description="Receive ordered perfume into liquid stock."
        backHref="/purchasing"
        backLabel="Purchasing"
      />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Ready to receive
        </h2>
        {!openOrders?.length ? (
          <EmptyState
            title="Nothing pending"
            description="Mark a purchase order as Ordered to receive stock."
          />
        ) : (
          <div className="space-y-3">
            {openOrders.map((order) => {
              const supplierName =
                order.suppliers &&
                typeof order.suppliers === "object" &&
                "name" in order.suppliers
                  ? String(order.suppliers.name)
                  : "—";
              return (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{order.po_number}</p>
                      <PoStatusPill status={order.status} />
                    </div>
                    <p className="mt-1 text-sm">
                      {itemNames(order.purchase_order_items, "quantity")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {supplierName} · {order.order_date} ·{" "}
                      {formatMmk(Number(order.total_mmk))}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/purchasing/orders/${order.id}`}
                      className={btnSecondaryClass}
                    >
                      View
                    </Link>
                    <Link
                      href={`/purchasing/orders/${order.id}/receive`}
                      className={btnPrimaryClass}
                    >
                      Receive
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Recent receipts
        </h2>
        {!recentReceipts?.length ? (
          <p className="text-sm text-[var(--muted)]">No receipts yet.</p>
        ) : (
          <div className="space-y-2">
            {recentReceipts.map((receipt) => {
              const poNumber =
                receipt.purchase_orders &&
                typeof receipt.purchase_orders === "object" &&
                "po_number" in receipt.purchase_orders
                  ? String(receipt.purchase_orders.po_number)
                  : "—";
              return (
                <div
                  key={receipt.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <p className="font-medium">
                    {receipt.receipt_number}{" "}
                    <span className="font-normal text-[var(--muted)]">
                      · {poNumber}
                    </span>
                  </p>
                  <p className="mt-1">
                    {itemNames(receipt.purchase_receipt_items, "quantity_bottles")}
                  </p>
                  <p className="text-[var(--muted)]">
                    {new Date(receipt.received_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
