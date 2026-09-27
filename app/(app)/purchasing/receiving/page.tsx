import Link from "next/link";

import { PoStatusPill } from "@/components/purchasing/po-status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
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

function formatReceivedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB");
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
      .limit(40),
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
          <>
            <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">PO</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {openOrders.map((order) => {
                    const supplierName =
                      asOne(order.suppliers as { name?: string } | null)
                        ?.name ?? "—";
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-[var(--stroke)] last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {order.po_number}
                        </td>
                        <td className="max-w-[16rem] px-4 py-3">
                          {itemNames(order.purchase_order_items, "quantity")}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {supplierName}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {order.order_date}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                          {formatMmk(Number(order.total_mmk))}
                        </td>
                        <td className="px-4 py-3">
                          <PoStatusPill status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {openOrders.map((order) => {
                const supplierName =
                  asOne(order.suppliers as { name?: string } | null)?.name ??
                  "—";
                return (
                  <div
                    key={order.id}
                    className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{order.po_number}</p>
                        <p className="mt-1 text-sm">
                          {itemNames(order.purchase_order_items, "quantity")}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {supplierName} · {order.order_date} ·{" "}
                          {formatMmk(Number(order.total_mmk))}
                        </p>
                      </div>
                      <PoStatusPill status={order.status} />
                    </div>
                    <div className="mt-3 flex gap-2">
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
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Recent receipts
        </h2>
        {!recentReceipts?.length ? (
          <p className="text-sm text-[var(--muted)]">No receipts yet.</p>
        ) : (
          <>
            <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Receipt</th>
                    <th className="px-4 py-3 font-medium">PO</th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Received</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReceipts.map((receipt) => {
                    const poNumber =
                      asOne(
                        receipt.purchase_orders as { po_number?: string } | null,
                      )?.po_number ?? "—";
                    return (
                      <tr
                        key={receipt.id}
                        className="border-b border-[var(--stroke)] last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {receipt.receipt_number}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {poNumber}
                        </td>
                        <td className="max-w-[16rem] px-4 py-3">
                          {itemNames(
                            receipt.purchase_receipt_items,
                            "quantity_bottles",
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                          {formatReceivedDate(receipt.received_at)}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {receipt.notes?.trim() || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {recentReceipts.map((receipt) => {
                const poNumber =
                  asOne(
                    receipt.purchase_orders as { po_number?: string } | null,
                  )?.po_number ?? "—";
                return (
                  <div
                    key={receipt.id}
                    className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
                  >
                    <p className="font-medium">
                      {receipt.receipt_number}{" "}
                      <span className="font-normal text-[var(--muted)]">
                        · {poNumber}
                      </span>
                    </p>
                    <p className="mt-1">
                      {itemNames(
                        receipt.purchase_receipt_items,
                        "quantity_bottles",
                      )}
                    </p>
                    <p className="mt-1 text-[var(--muted)]">
                      {formatReceivedDate(receipt.received_at)}
                      {receipt.notes?.trim()
                        ? ` · ${receipt.notes.trim()}`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
