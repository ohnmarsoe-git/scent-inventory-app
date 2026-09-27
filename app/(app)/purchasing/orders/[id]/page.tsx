import Link from "next/link";
import { notFound } from "next/navigation";

import { DepositForm } from "@/components/purchasing/deposit-form";
import { PoStatusButton } from "@/components/purchasing/po-status-button";
import { PoStatusPill } from "@/components/purchasing/po-status-pill";
import { PageHeader } from "@/components/ui/page-header";
import {
  cancelPurchaseOrder,
  markPurchaseOrderOrdered,
} from "@/lib/actions/purchasing";
import { createClient } from "@/lib/supabase/server";
import { btnPrimaryClass, btnSecondaryClass, formatMmk } from "@/lib/ui";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("purchase_orders")
    .select(
      "*, suppliers(name), purchase_order_items(*, perfumes(name, brands(name)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const { data: receipts } = await supabase
    .from("purchase_receipts")
    .select("id, receipt_number, received_at, notes")
    .eq("purchase_order_id", id)
    .order("received_at", { ascending: false });

  const supplierName =
    order.suppliers &&
    typeof order.suppliers === "object" &&
    "name" in order.suppliers
      ? String(order.suppliers.name)
      : "—";

  const items = Array.isArray(order.purchase_order_items)
    ? order.purchase_order_items
    : [];

  const canReceive =
    order.status === "ordered" || order.status === "partially_received";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <PageHeader
        title={order.po_number}
        description={`${supplierName} · ${order.order_date}`}
        backHref="/purchasing/orders"
        backLabel="Purchase orders"
      />

      <div className="flex flex-wrap items-center gap-3">
        <PoStatusPill status={order.status} />
        {order.status === "draft" ? (
          <>
            <Link
              href={`/purchasing/orders/${order.id}/edit`}
              className={btnSecondaryClass}
            >
              Edit draft
            </Link>
            <PoStatusButton
              id={order.id}
              action={markPurchaseOrderOrdered}
              label="Mark ordered"
              variant="primary"
              confirmMessage="Mark this PO as ordered? You can receive stock after this."
            />
            <PoStatusButton
              id={order.id}
              action={cancelPurchaseOrder}
              label="Cancel"
              confirmMessage="Cancel this draft purchase order?"
            />
          </>
        ) : null}
        {order.status === "ordered" ? (
          <PoStatusButton
            id={order.id}
            action={cancelPurchaseOrder}
            label="Cancel"
            confirmMessage="Cancel this ordered PO? Only if nothing has been received."
          />
        ) : null}
        {canReceive ? (
          <Link
            href={`/purchasing/orders/${order.id}/receive`}
            className={btnPrimaryClass}
          >
            Receive stock
          </Link>
        ) : null}
      </div>

      <section className="grid gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block">
          <p className="text-[var(--muted)]">Currency</p>
          <p>
            {order.currency} @ {Number(order.exchange_rate)}
          </p>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <p className="text-[var(--muted)]">Expected arrival</p>
          <p>{order.expected_arrival_date || "—"}</p>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <p className="text-[var(--muted)]">Shipping (MMK)</p>
          <p className="tabular-nums">
            {formatMmk(Number(order.shipping_cost_mmk))}
          </p>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <p className="text-[var(--muted)]">Other costs (MMK)</p>
          <p className="tabular-nums">{formatMmk(Number(order.other_cost_mmk))}</p>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <p className="text-[var(--muted)]">Subtotal (MMK)</p>
          <p className="tabular-nums">{formatMmk(Number(order.subtotal_mmk))}</p>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <p className="text-[var(--muted)]">Total (MMK)</p>
          <p className="font-medium tabular-nums">
            {formatMmk(Number(order.total_mmk))}
          </p>
        </div>
        {order.notes ? (
          <div className="sm:col-span-2">
            <p className="text-[var(--muted)]">Notes</p>
            <p className="mt-1">{order.notes}</p>
          </div>
        ) : null}
      </section>

      {order.status !== "cancelled" ? (
        <section className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Deposit
          </h2>
          <DepositForm
            orderId={order.id}
            totalMmk={Number(order.total_mmk)}
            paidMmk={Number(order.deposit_paid_mmk ?? 0)}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Lines
        </h2>
        <div className="space-y-3">
          {items.map(
            (item: {
              id: string;
              quantity: number;
              received_quantity: number;
              bottle_size_ml: number;
              unit_cost_mmk: number;
              line_total_mmk: number;
              perfumes?: { name?: string; brands?: { name?: string } } | null;
            }) => {
              const brand = item.perfumes?.brands?.name;
              const perfumeName = item.perfumes?.name ?? "Perfume";
              const label = brand ? `${brand} — ${perfumeName}` : perfumeName;
              return (
                <div
                  key={item.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
                >
                  <p className="font-medium">{label}</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {Number(item.bottle_size_ml)} ml × {Number(item.quantity)}{" "}
                    bottles · unit {formatMmk(Number(item.unit_cost_mmk))} · line{" "}
                    {formatMmk(Number(item.line_total_mmk))}
                  </p>
                  <p className="mt-1 text-[var(--muted)]">
                    Received {Number(item.received_quantity)} /{" "}
                    {Number(item.quantity)}
                  </p>
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Receipts
        </h2>
        {!receipts?.length ? (
          <p className="text-sm text-[var(--muted)]">No receipts yet.</p>
        ) : (
          <div className="space-y-2">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm"
              >
                <p className="font-medium">{receipt.receipt_number}</p>
                <p className="text-[var(--muted)]">
                  {new Date(receipt.received_at).toLocaleDateString()}
                  {receipt.notes ? ` · ${receipt.notes}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
