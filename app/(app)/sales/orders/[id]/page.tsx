import { notFound } from "next/navigation";

import { reverseOverpayment } from "@/lib/actions/sales";
import { PaymentForm } from "@/components/sales/payment-form";
import { PaymentStatusPill } from "@/components/sales/payment-status-pill";
import { PageHeader } from "@/components/ui/page-header";
import { asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/sales";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SaleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select("*, customers(name), sale_items(*), payments(*)")
    .eq("id", id)
    .maybeSingle();

  if (!sale) notFound();

  let reverseError: string | null = null;
  if (sale.payment_status === "overpaid") {
    const reversed = await reverseOverpayment(id);
    if (!reversed.ok) {
      reverseError = reversed.error;
    } else {
      const { data: refreshed } = await supabase
        .from("sales")
        .select("*, customers(name), sale_items(*), payments(*)")
        .eq("id", id)
        .maybeSingle();
      if (refreshed) Object.assign(sale, refreshed);
    }
  }

  const customer =
    asOne(sale.customers as { name?: string } | null)?.name ?? "Walk-in";
  const items = Array.isArray(sale.sale_items) ? sale.sale_items : [];
  const payments = Array.isArray(sale.payments)
    ? [...sale.payments].sort(
        (a, b) =>
          String(b.payment_date).localeCompare(String(a.payment_date)) ||
          String(b.created_at).localeCompare(String(a.created_at)),
      )
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title={sale.sale_number}
        description={`${customer} · ${sale.sale_date}`}
        backHref="/sales/orders"
        backLabel="Sales"
      />

      <div className="flex flex-wrap items-center gap-3">
        <PaymentStatusPill status={sale.payment_status} />
      </div>
      {reverseError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {reverseError}
        </p>
      ) : null}

      <section className="grid gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[var(--muted)]">Total</p>
          <p className="mt-1 tabular-nums font-medium">
            {formatMmk(Number(sale.total_mmk))}
          </p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Paid / remaining</p>
          <p className="mt-1 tabular-nums">
            {formatMmk(Number(sale.paid_amount_mmk))} /{" "}
            {formatMmk(Number(sale.remaining_amount_mmk))}
          </p>
        </div>
        <div>
          <p className="text-[var(--muted)]">COGS</p>
          <p className="mt-1 tabular-nums">{formatMmk(Number(sale.cogs_mmk))}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Gross profit</p>
          <p className="mt-1 tabular-nums font-medium">
            {formatMmk(Number(sale.gross_profit_mmk))}
          </p>
        </div>
        {sale.notes ? (
          <div className="sm:col-span-2">
            <p className="text-[var(--muted)]">Notes</p>
            <p className="mt-1">{sale.notes}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Lines
        </h2>
        {items.map(
          (item: {
            id: string;
            description: string;
            quantity: number;
            unit_sale_price_mmk: number;
            line_total_mmk: number;
            cogs_mmk: number;
            profit_mmk: number;
            size_ml: number | null;
          }) => (
            <div
              key={item.id}
              className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
            >
              <p className="font-medium">{item.description}</p>
              <p className="mt-2 text-lg font-medium tabular-nums">
                {formatMmk(Number(item.unit_sale_price_mmk))}
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                  sell price
                  {item.size_ml ? ` · ${Number(item.size_ml)}ml` : ""}
                  {Number(item.quantity) > 1
                    ? ` × ${Number(item.quantity)}`
                    : ""}
                </span>
              </p>
              <p className="mt-1 tabular-nums text-[var(--muted)]">
                Line {formatMmk(Number(item.line_total_mmk))} · COGS{" "}
                {formatMmk(Number(item.cogs_mmk))} · Profit{" "}
                {formatMmk(Number(item.profit_mmk))}
              </p>
            </div>
          ),
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Payments
        </h2>
        {!payments.length ? (
          <p className="text-sm text-[var(--muted)]">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map(
              (payment: {
                id: string;
                payment_number: string;
                payment_date: string;
                amount_mmk: number;
                payment_method: string;
                notes: string | null;
              }) => (
                <div
                  key={payment.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <p className="font-medium">
                    {payment.payment_number} ·{" "}
                    {formatMmk(Number(payment.amount_mmk))}
                  </p>
                  <p className="text-[var(--muted)]">
                    {payment.payment_date} ·{" "}
                    {PAYMENT_METHOD_LABELS[payment.payment_method] ??
                      payment.payment_method}
                    {payment.notes ? ` · ${payment.notes}` : ""}
                  </p>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {!sale.is_voided && Number(sale.remaining_amount_mmk) > 0 ? (
        <section className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Record payment
          </h2>
          <PaymentForm
            saleId={sale.id}
            remainingAmount={Number(sale.remaining_amount_mmk)}
          />
        </section>
      ) : null}
    </div>
  );
}
