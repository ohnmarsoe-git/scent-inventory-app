import Link from "next/link";
import { notFound } from "next/navigation";

import { reverseOverpayment } from "@/lib/actions/sales";
import { PaymentForm } from "@/components/sales/payment-form";
import { SaleVoucher } from "@/components/sales/sale-voucher";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/sales/orders"
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Sales
        </Link>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Sale order
        </p>
      </div>

      {reverseError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {reverseError}
        </p>
      ) : null}

      <SaleVoucher
        saleNumber={sale.sale_number}
        saleDate={sale.sale_date}
        customerName={customer}
        paymentStatus={sale.payment_status}
        isVoided={Boolean(sale.is_voided)}
        notes={sale.notes}
        items={items.map(
          (item: {
            id: string;
            description: string;
            quantity: number;
            unit_sale_price_mmk: number;
            line_total_mmk: number;
            line_discount_mmk?: number | null;
            cogs_mmk: number;
            profit_mmk: number;
            size_ml: number | null;
          }) => ({
            id: item.id,
            description: item.description,
            quantity: Number(item.quantity),
            unit_sale_price_mmk: Number(item.unit_sale_price_mmk),
            line_total_mmk: Number(item.line_total_mmk),
            line_discount_mmk: item.line_discount_mmk,
            cogs_mmk: Number(item.cogs_mmk),
            profit_mmk: Number(item.profit_mmk),
            size_ml: item.size_ml == null ? null : Number(item.size_ml),
          }),
        )}
        subtotalMmk={Number(sale.subtotal_mmk)}
        discountMmk={Number(sale.discount_mmk)}
        totalMmk={Number(sale.total_mmk)}
        paidMmk={Number(sale.paid_amount_mmk)}
        remainingMmk={Number(sale.remaining_amount_mmk)}
        cogsMmk={Number(sale.cogs_mmk)}
        grossProfitMmk={Number(sale.gross_profit_mmk)}
      />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Payment history
        </h2>
        {!payments.length ? (
          <p className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden border border-[var(--stroke)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Method</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(
                  (payment: {
                    id: string;
                    payment_number: string;
                    payment_date: string;
                    amount_mmk: number;
                    payment_method: string;
                    notes: string | null;
                  }) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{payment.payment_number}</p>
                        {payment.notes ? (
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {payment.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {payment.payment_date}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {PAYMENT_METHOD_LABELS[payment.payment_method] ??
                          payment.payment_method}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatMmk(Number(payment.amount_mmk))}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!sale.is_voided && Number(sale.remaining_amount_mmk) > 0 ? (
        <section className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:p-5">
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
