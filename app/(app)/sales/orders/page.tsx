import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { PaymentStatusPill } from "@/components/sales/payment-status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

type SaleLine = {
  description?: string | null;
  size_ml?: number | string | null;
  quantity?: number | string | null;
  perfumes?: unknown;
};

function lineLabel(line: SaleLine): string {
  const name = line.description?.trim() || perfumeLabel(line.perfumes);
  const size = Number(line.size_ml);
  const qty = Number(line.quantity);
  const sizePart = Number.isFinite(size) && size > 0 ? `${size} ml` : "";
  const qtyPart = Number.isFinite(qty) && qty > 1 ? `× ${qty}` : "";
  // Description often already includes size; avoid duplicating when present.
  if (line.description?.trim()) {
    return qtyPart ? `${name} ${qtyPart}` : name;
  }
  return [name, sizePart, qtyPart].filter(Boolean).join(" ");
}

function saleItemNames(items: unknown): string {
  const lines = Array.isArray(items) ? (items as SaleLine[]) : [];
  if (!lines.length) return "—";
  return lines.map(lineLabel).join(", ");
}

function saleItemQty(items: unknown): number {
  const lines = Array.isArray(items) ? (items as SaleLine[]) : [];
  return lines.reduce((sum, line) => {
    const qty = Number(line.quantity);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

function saleItemMl(items: unknown): number {
  const lines = Array.isArray(items) ? (items as SaleLine[]) : [];
  return lines.reduce((sum, line) => {
    const size = Number(line.size_ml);
    const qty = Number(line.quantity);
    if (!Number.isFinite(size) || size <= 0) return sum;
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    return sum + size * qty;
  }, 0);
}

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value)
    ? String(value)
    : String(Math.round(value * 100) / 100);
}

function statusHref(status: string, q: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/sales/orders?${query}` : "/sales/orders";
}

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function SalesOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const supabase = await createClient();

  let matchedIds: string[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    const [byNumber, byDescription, byCustomer, byPerfume] = await Promise.all([
      supabase
        .from("sales")
        .select("id")
        .eq("is_voided", false)
        .ilike("sale_number", pattern),
      supabase.from("sale_items").select("sale_id").ilike("description", pattern),
      supabase
        .from("sales")
        .select("id, customers!inner(name)")
        .eq("is_voided", false)
        .ilike("customers.name", pattern),
      supabase
        .from("sale_items")
        .select("sale_id, perfumes!inner(name)")
        .ilike("perfumes.name", pattern),
    ]);

    matchedIds = [
      ...new Set(
        [
          ...(byNumber.data ?? []).map((row) => row.id),
          ...(byDescription.data ?? []).map((row) => row.sale_id),
          ...(byCustomer.data ?? []).map((row) => row.id),
          ...(byPerfume.data ?? []).map((row) => row.sale_id),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  let query = supabase
    .from("sales")
    .select(
      "id, sale_number, sale_date, payment_status, total_mmk, paid_amount_mmk, remaining_amount_mmk, gross_profit_mmk, customers(name), sale_items(description, size_ml, quantity, perfumes(name, brands(name)))",
    )
    .eq("is_voided", false)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("payment_status", status);
  if (matchedIds) {
    if (!matchedIds.length) {
      return (
        <SalesOrdersShell q={q} status={status}>
          <EmptyState
            title="No matching sales"
            description="Try another sale number, customer, or item name."
          />
        </SalesOrdersShell>
      );
    }
    query = query.in("id", matchedIds);
  }

  const { data: sales, error } = await query;

  const totalSaleQty = (sales ?? []).reduce(
    (sum, sale) => sum + saleItemQty(sale.sale_items),
    0,
  );
  const totalSaleMl = (sales ?? []).reduce(
    (sum, sale) => sum + saleItemMl(sale.sale_items),
    0,
  );
  const totalSaleAmount = (sales ?? []).reduce(
    (sum, sale) => sum + (Number(sale.total_mmk) || 0),
    0,
  );
  const filterHint =
    q || status
      ? "For the current search and status filter."
      : "All non-voided sales.";

  return (
    <SalesOrdersShell q={q} status={status}>
      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !sales?.length ? (
        <EmptyState
          title="No sales yet"
          description="Create a sale from decant or liquid stock."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Total sale qty"
              value={totalSaleQty}
              currency={false}
              hint={filterHint}
            />
            <MetricCard
              label="Total ml qty"
              value={totalSaleMl}
              currency={false}
              hint={`ml sold · ${filterHint}`}
            />
            <MetricCard
              label="Total sale amount"
              value={totalSaleAmount}
              emphasize
              hint={filterHint}
            />
          </div>

          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Sale</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Profit</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => {
                  const customer =
                    asOne(sale.customers as { name?: string } | null)?.name ??
                    "Walk-in";
                  const qty = saleItemQty(sale.sale_items);
                  return (
                    <tr
                      key={sale.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">
                        {sale.sale_number}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3">
                        {saleItemNames(sale.sale_items)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatQty(qty)}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {customer}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {sale.sale_date}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatMmk(Number(sale.total_mmk))}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMmk(Number(sale.paid_amount_mmk))}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMmk(Number(sale.gross_profit_mmk))}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusPill status={sale.payment_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/sales/orders/${sale.id}`}
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
            {sales.map((sale) => {
              const customer =
                asOne(sale.customers as { name?: string } | null)?.name ??
                "Walk-in";
              const qty = saleItemQty(sale.sale_items);
              return (
                <Link
                  key={sale.id}
                  href={`/sales/orders/${sale.id}`}
                  className="block border border-[var(--stroke)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{sale.sale_number}</p>
                      <p className="mt-1 text-sm">
                        {saleItemNames(sale.sale_items)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {customer} · {sale.sale_date} · qty {formatQty(qty)}
                      </p>
                      <p className="mt-1 text-sm tabular-nums">
                        {formatMmk(Number(sale.total_mmk))} · paid{" "}
                        {formatMmk(Number(sale.paid_amount_mmk))} · profit{" "}
                        {formatMmk(Number(sale.gross_profit_mmk))}
                      </p>
                    </div>
                    <PaymentStatusPill status={sale.payment_status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </SalesOrdersShell>
  );
}

function SalesOrdersShell({
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
    { status: "unpaid", label: "Unpaid" },
    { status: "partial", label: "Partial" },
    { status: "paid", label: "Paid" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Sales"
        description="Revenue, COGS, and collections."
        actionHref="/sales/orders/new"
        actionLabel="New sale"
        backHref="/sales"
        backLabel="Sales"
      />

      <Suspense fallback={null}>
        <SearchFilter
          placeholder="Search sale number, customer, or item…"
          showArchivedToggle={false}
        />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => {
          const active =
            status === item.status || (!status && !item.status);
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
