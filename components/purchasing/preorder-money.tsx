import { summarizePreorders } from "@/lib/domain/preorder";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

export async function PreorderMoney() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("status, total_mmk, deposit_paid_mmk");

  if (error) {
    return (
      <p className="text-sm text-[var(--danger)]">
        {error.message}. If the deposit column is missing, run{" "}
        <code>20260919140000_po_deposit.sql</code> in Supabase.
      </p>
    );
  }

  const money = summarizePreorders(
    (data ?? []).map((order) => ({
      status: order.status,
      total_mmk: Number(order.total_mmk),
      deposit_paid_mmk: Number(order.deposit_paid_mmk ?? 0),
    })),
  );

  return (
    <div className="grid gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-2">
      <div>
        <p className="text-[var(--muted)]">Invested in pre-orders</p>
        <p className="mt-1 font-medium tabular-nums">{formatMmk(money.invested)}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Already paid on bottles that have not arrived. Not an expense.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Still to pay</p>
        <p className="mt-1 font-medium tabular-nums">{formatMmk(money.left)}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Balance due on open orders, including pay-on-arrival.
        </p>
      </div>
    </div>
  );
}
