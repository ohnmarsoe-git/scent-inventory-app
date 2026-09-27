import { PaymentStatusPill } from "@/components/sales/payment-status-pill";
import { formatMmk } from "@/lib/ui";

export type SaleVoucherLine = {
  id: string;
  description: string;
  quantity: number;
  unit_sale_price_mmk: number;
  line_total_mmk: number;
  line_discount_mmk?: number | null;
  cogs_mmk: number;
  profit_mmk: number;
  size_ml: number | null;
};

export type SaleVoucherProps = {
  saleNumber: string;
  saleDate: string;
  customerName: string;
  paymentStatus: string;
  isVoided?: boolean;
  notes?: string | null;
  items: SaleVoucherLine[];
  subtotalMmk: number;
  discountMmk: number;
  totalMmk: number;
  paidMmk: number;
  remainingMmk: number;
  cogsMmk: number;
  grossProfitMmk: number;
};

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value)
    ? String(value)
    : String(Math.round(value * 100) / 100);
}

export function SaleVoucher({
  saleNumber,
  saleDate,
  customerName,
  paymentStatus,
  isVoided = false,
  notes,
  items,
  subtotalMmk,
  discountMmk,
  totalMmk,
  paidMmk,
  remainingMmk,
  cogsMmk,
  grossProfitMmk,
}: SaleVoucherProps) {
  return (
    <article className="overflow-hidden border border-[var(--stroke)] bg-white shadow-[0_1px_0_rgba(20,22,26,0.04),0_12px_32px_rgba(20,22,26,0.06)]">
      <header className="border-b border-[var(--stroke)] bg-[var(--surface)] px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
              Scent Syntax
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Sale voucher
            </p>
          </div>
          <div className="text-right">
            <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              {saleNumber}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">Date {saleDate}</p>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <PaymentStatusPill status={paymentStatus} />
              {isVoided ? (
                <span className="inline-flex items-center border border-[var(--danger)] px-2 py-0.5 text-xs uppercase tracking-[0.12em] text-[var(--danger)]">
                  Voided
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 border-b border-[var(--stroke)] px-5 py-5 sm:grid-cols-2 sm:px-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Bill to
          </p>
          <p className="mt-1.5 text-base font-medium text-[var(--ink)]">
            {customerName}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Amount due
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-display)] text-2xl tabular-nums text-[var(--ink)]">
            {formatMmk(remainingMmk)}
          </p>
        </div>
      </section>

      <section className="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--stroke)] bg-[var(--surface)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="px-5 py-3 font-medium sm:px-8">#</th>
                <th className="px-3 py-3 font-medium">Description</th>
                <th className="px-3 py-3 font-medium">Size</th>
                <th className="px-3 py-3 text-right font-medium">Qty</th>
                <th className="px-3 py-3 text-right font-medium">Price</th>
                <th className="px-3 py-3 text-right font-medium">Amount</th>
                <th className="px-3 py-3 text-right font-medium">COGS</th>
                <th className="px-5 py-3 text-right font-medium sm:px-8">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--stroke)] last:border-0"
                >
                  <td className="px-5 py-3.5 tabular-nums text-[var(--muted)] sm:px-8">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3.5 font-medium text-[var(--ink)]">
                    {item.description}
                  </td>
                  <td className="px-3 py-3.5 tabular-nums text-[var(--muted)]">
                    {item.size_ml ? `${Number(item.size_ml)} ml` : "—"}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--muted)]">
                    {formatQty(Number(item.quantity))}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--muted)]">
                    {formatMmk(Number(item.unit_sale_price_mmk))}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums font-medium">
                    {formatMmk(Number(item.line_total_mmk))}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[var(--muted)]">
                    {formatMmk(Number(item.cogs_mmk))}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums font-medium text-[var(--success)] sm:px-8">
                    {formatMmk(Number(item.profit_mmk))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-[var(--stroke)] px-5 py-5 sm:px-8">
        <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-6">
            <span className="text-[var(--muted)]">Subtotal</span>
            <span className="tabular-nums">{formatMmk(subtotalMmk)}</span>
          </div>
          {discountMmk > 0 ? (
            <div className="flex justify-between gap-6">
              <span className="text-[var(--muted)]">Discount</span>
              <span className="tabular-nums">−{formatMmk(discountMmk)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-6 border-t border-[var(--stroke)] pt-2">
            <span className="font-medium">Total</span>
            <span className="font-[family-name:var(--font-display)] text-xl tabular-nums">
              {formatMmk(totalMmk)}
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-[var(--muted)]">Paid</span>
            <span className="tabular-nums">{formatMmk(paidMmk)}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-[var(--stroke)] pt-2">
            <span className="font-medium">Balance</span>
            <span className="tabular-nums font-medium">
              {formatMmk(remainingMmk)}
            </span>
          </div>
        </div>
      </section>

      {notes ? (
        <section className="border-t border-[var(--stroke)] px-5 py-4 sm:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Notes
          </p>
          <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{notes}</p>
        </section>
      ) : null}

      <footer className="border-t border-dashed border-[var(--stroke)] bg-[var(--surface)] px-5 py-3 sm:px-8">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--muted)]">
          <span>
            COGS{" "}
            <span className="tabular-nums text-[var(--ink-soft)]">
              {formatMmk(cogsMmk)}
            </span>
          </span>
          <span>
            Gross profit{" "}
            <span className="tabular-nums text-[var(--ink-soft)]">
              {formatMmk(grossProfitMmk)}
            </span>
          </span>
          <span className="text-[var(--muted)]">Internal · not on customer copy</span>
        </div>
      </footer>
    </article>
  );
}
