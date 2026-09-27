import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/sales";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: payments, error } = await supabase
    .from("payments")
    .select(
      "id, payment_number, payment_date, amount_mmk, payment_method, notes, sales(id, sale_number), customers(name)",
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Cash collected — separate from sale revenue recognition."
        backHref="/sales"
        backLabel="Sales"
      />

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !payments?.length ? (
        <EmptyState
          title="No payments yet"
          description="Record payments from a sale detail page."
        />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const sale = asOne(
              payment.sales as { id?: string; sale_number?: string } | null,
            );
            const customer =
              asOne(payment.customers as { name?: string } | null)?.name ??
              "Walk-in";
            return (
              <div
                key={payment.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {payment.payment_number} ·{" "}
                      {formatMmk(Number(payment.amount_mmk))}
                    </p>
                    <p className="mt-1 text-[var(--muted)]">
                      {payment.payment_date} ·{" "}
                      {PAYMENT_METHOD_LABELS[payment.payment_method] ??
                        payment.payment_method}{" "}
                      · {customer}
                    </p>
                    {sale?.id ? (
                      <Link
                        href={`/sales/orders/${sale.id}`}
                        className="mt-2 inline-block text-[var(--accent)] underline"
                      >
                        {sale.sale_number}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
