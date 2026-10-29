"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { PoStatusPill } from "@/components/purchasing/po-status-pill";
import { deleteDraftPurchaseOrders } from "@/lib/actions/purchasing";
import { moneyLeft } from "@/lib/domain/preorder";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

export type PurchaseOrderListRow = {
  id: string;
  po_number: string;
  order_date: string;
  status: string;
  total_mmk: number | string;
  deposit_paid_mmk: number | string | null;
  suppliers: unknown;
  purchase_order_items: unknown;
};

type PoLine = {
  quantity: number;
  bottle_size_ml: number;
  perfumes: unknown;
};

function itemName(line: PoLine): string {
  const name = perfumeLabel(line.perfumes);
  const size = Number(line.bottle_size_ml);
  const qty = Number(line.quantity);
  const sizePart = Number.isFinite(size) && size > 0 ? `${size} ml` : "";
  const qtyPart = Number.isFinite(qty) && qty > 1 ? `× ${qty}` : "";
  return [name, sizePart, qtyPart].filter(Boolean).join(" ");
}

function orderItemNames(items: unknown): string {
  const lines = Array.isArray(items) ? (items as PoLine[]) : [];
  if (!lines.length) return "—";
  return lines.map(itemName).join(", ");
}

type Props = {
  orders: PurchaseOrderListRow[];
};

export function PurchaseOrdersList({ orders }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const draftIds = useMemo(
    () => orders.filter((order) => order.status === "draft").map((order) => order.id),
    [orders],
  );
  const selectedDraftIds = useMemo(
    () => [...selected].filter((id) => draftIds.includes(id)),
    [selected, draftIds],
  );
  const allDraftsSelected =
    draftIds.length > 0 && selectedDraftIds.length === draftIds.length;

  function toggle(id: string, isDraft: boolean) {
    if (!isDraft) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllDrafts() {
    setSelected((prev) => {
      if (allDraftsSelected) {
        const next = new Set(prev);
        for (const id of draftIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of draftIds) next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    if (!selectedDraftIds.length) return;
    const count = selectedDraftIds.length;
    const ok = window.confirm(
      count === 1
        ? "Delete this draft purchase order? This cannot be undone."
        : `Delete ${count} draft purchase orders? This cannot be undone.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteDraftPurchaseOrders(selectedDraftIds);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {draftIds.length ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-[var(--muted)]">
            <input
              type="checkbox"
              checked={allDraftsSelected}
              disabled={pending || !draftIds.length}
              onChange={toggleAllDrafts}
            />
            Select all drafts
          </label>
          {selectedDraftIds.length ? (
            <button
              type="button"
              disabled={pending}
              className={btnSecondaryClass}
              onClick={deleteSelected}
            >
              {pending
                ? "Deleting…"
                : `Delete ${selectedDraftIds.length} draft${selectedDraftIds.length === 1 ? "" : "s"}`}
            </button>
          ) : (
            <p className="text-[var(--muted)]">
              Select draft orders to delete.
            </p>
          )}
        </div>
      ) : null}

      <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            <tr>
              <th className="w-10 px-4 py-3 font-medium">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-4 py-3 font-medium">PO</th>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Total (MMK)</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Left</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isDraft = order.status === "draft";
              const supplierName =
                asOne(order.suppliers as { name?: string } | null)?.name ?? "—";
              return (
                <tr
                  key={order.id}
                  className="border-b border-[var(--stroke)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      disabled={!isDraft || pending}
                      aria-label={`Select ${order.po_number}`}
                      onChange={() => toggle(order.id, isDraft)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{order.po_number}</td>
                  <td className="px-4 py-3">
                    {orderItemNames(order.purchase_order_items)}
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
                  <td className="px-4 py-3 tabular-nums">
                    {formatMmk(Number(order.deposit_paid_mmk ?? 0))}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMmk(
                      moneyLeft(
                        Number(order.total_mmk),
                        Number(order.deposit_paid_mmk ?? 0),
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PoStatusPill status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/purchasing/orders/${order.id}`}
                      className={btnSecondaryClass}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {orders.map((order) => {
          const isDraft = order.status === "draft";
          const supplierName =
            asOne(order.suppliers as { name?: string } | null)?.name ?? "—";
          return (
            <div
              key={order.id}
              className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(order.id)}
                  disabled={!isDraft || pending}
                  aria-label={`Select ${order.po_number}`}
                  onChange={() => toggle(order.id, isDraft)}
                />
                <Link href={`/purchasing/orders/${order.id}`} className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{order.po_number}</p>
                      <p className="mt-1 text-sm">
                        {orderItemNames(order.purchase_order_items)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {supplierName} · {order.order_date}
                      </p>
                      <p className="mt-1 text-sm tabular-nums">
                        {formatMmk(Number(order.total_mmk))} · paid{" "}
                        {formatMmk(Number(order.deposit_paid_mmk ?? 0))} · left{" "}
                        {formatMmk(
                          moneyLeft(
                            Number(order.total_mmk),
                            Number(order.deposit_paid_mmk ?? 0),
                          ),
                        )}
                      </p>
                    </div>
                    <PoStatusPill status={order.status} />
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
