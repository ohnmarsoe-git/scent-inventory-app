import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { PoStatusPill } from "@/components/purchasing/po-status-pill";
import { PreorderMoney } from "@/components/purchasing/preorder-money";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { moneyLeft } from "@/lib/domain/preorder";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

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

function statusHref(status: string, q: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/purchasing/orders?${query}` : "/purchasing/orders";
}

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string; status?: string }>;
};

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";

  const supabase = await createClient();

  let matchedIds: string[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    const [byNumber, byPerfume, byBrand, bySupplier] = await Promise.all([
      supabase.from("purchase_orders").select("id").ilike("po_number", pattern),
      supabase
        .from("purchase_order_items")
        .select("purchase_order_id, perfumes!inner(name)")
        .ilike("perfumes.name", pattern),
      supabase
        .from("purchase_order_items")
        .select("purchase_order_id, perfumes!inner(brands!inner(name))")
        .ilike("perfumes.brands.name", pattern),
      supabase
        .from("purchase_orders")
        .select("id, suppliers!inner(name)")
        .ilike("suppliers.name", pattern),
    ]);

    matchedIds = [
      ...new Set(
        [
          ...(byNumber.data ?? []).map((row) => row.id),
          ...(byPerfume.data ?? []).map((row) => row.purchase_order_id),
          ...(byBrand.data ?? []).map((row) => row.purchase_order_id),
          ...(bySupplier.data ?? []).map((row) => row.id),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  let query = supabase
    .from("purchase_orders")
    .select(
      "id, po_number, order_date, status, currency, total_mmk, deposit_paid_mmk, total_original, suppliers(name), purchase_order_items(quantity, bottle_size_ml, perfumes(name, brands(name)))",
    )
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (matchedIds) {
    if (!matchedIds.length) {
      return (
        <PurchaseOrdersShell q={q} status={status}>
          <EmptyState
            title="No matching purchase orders"
            description="Try another PO number, supplier, or item name."
          />
        </PurchaseOrdersShell>
      );
    }
    query = query.in("id", matchedIds);
  }

  const { data: orders, error } = await query;

  return (
    <PurchaseOrdersShell q={q} status={status}>
      {!error ? <PreorderMoney /> : null}

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !orders?.length ? (
        <EmptyState
          title="No purchase orders"
          description="Create a draft PO, mark it ordered, then receive stock."
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
                  <th className="px-4 py-3 font-medium">Total (MMK)</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Left</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const supplierName =
                    asOne(order.suppliers as { name?: string } | null)?.name ??
                    "—";
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
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
              const supplierName =
                asOne(order.suppliers as { name?: string } | null)?.name ?? "—";
              return (
                <Link
                  key={order.id}
                  href={`/purchasing/orders/${order.id}`}
                  className="block border border-[var(--stroke)] bg-[var(--surface)] p-4"
                >
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
              );
            })}
          </div>
        </>
      )}
    </PurchaseOrdersShell>
  );
}

function PurchaseOrdersShell({
  q,
  status,
  children,
}: {
  q: string;
  status: string;
  children: ReactNode;
}) {
  const filters = [
    { status: "", label: "All" },
    { status: "draft", label: "Draft" },
    { status: "ordered", label: "Ordered" },
    { status: "partially_received", label: "Partial" },
    { status: "received", label: "Received" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Purchase orders"
        description="Pre-orders stay Ordered until the bottle arrives. Paid money is invested in that stock. Left to pay is still owed."
        actionHref="/purchasing/orders/new"
        actionLabel="New PO"
        backHref="/purchasing"
        backLabel="Purchasing"
      />

      <Suspense fallback={null}>
        <SearchFilter
          placeholder="Search PO number, supplier, or item…"
          showArchivedToggle={false}
        />
      </Suspense>

      <div className="flex flex-wrap gap-2 text-sm">
        {filters.map((item) => {
          const active = status === item.status || (!status && !item.status);
          return (
            <Link
              key={item.label}
              href={statusHref(item.status, q)}
              className={btnSecondaryClass}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
