import Link from "next/link";
import { Suspense } from "react";

import { PaymentStatusPill } from "@/components/sales/payment-status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function SalesOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase
    .from("sales")
    .select(
      "id, sale_number, sale_date, payment_status, total_mmk, paid_amount_mmk, remaining_amount_mmk, gross_profit_mmk, customers(name)",
    )
    .eq("is_voided", false)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("payment_status", status);
  if (q) query = query.ilike("sale_number", `%${q}%`);

  const { data: sales, error } = await query;

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
        <SearchFilter placeholder="Search sale number…" showArchivedToggle={false} />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        {[
          { href: "/sales/orders", label: "All" },
          { href: "/sales/orders?status=unpaid", label: "Unpaid" },
          { href: "/sales/orders?status=partial", label: "Partial" },
          { href: "/sales/orders?status=paid", label: "Paid" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className={btnSecondaryClass}>
            {item.label}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !sales?.length ? (
        <EmptyState
          title="No sales yet"
          description="Create a sale from decant or liquid stock."
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const customer =
              asOne(sale.customers as { name?: string } | null)?.name ??
              "Walk-in";
            return (
              <Link
                key={sale.id}
                href={`/sales/orders/${sale.id}`}
                className="block border border-[var(--stroke)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{sale.sale_number}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {customer} · {sale.sale_date}
                    </p>
                    <p className="mt-2 text-sm tabular-nums">
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
      )}
    </div>
  );
}
