"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setPurchaseOrderDeposit } from "@/lib/actions/purchasing";
import { moneyLeft } from "@/lib/domain/preorder";
import { btnPrimaryClass, btnSecondaryClass, fieldClass, formatMmk, labelClass } from "@/lib/ui";

type DepositFormProps = {
  orderId: string;
  totalMmk: number;
  paidMmk: number;
};

export function DepositForm({ orderId, totalMmk, paidMmk }: DepositFormProps) {
  const router = useRouter();
  const [paid, setPaid] = useState(String(Math.round(paidMmk)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amount = Number(paid) || 0;
  const left = moneyLeft(totalMmk, amount);

  function save(next: number) {
    setError(null);
    setPaid(String(Math.round(next)));
    startTransition(async () => {
      const result = await setPurchaseOrderDeposit(orderId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[var(--muted)]">Paid so far</p>
          <p className="mt-1 font-medium tabular-nums">{formatMmk(paidMmk)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Left to pay</p>
          <p className="mt-1 font-medium tabular-nums">{formatMmk(moneyLeft(totalMmk, paidMmk))}</p>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Paid money is invested in this bottle until it arrives. It is not an
        expense. Enter the total you have paid so far, including a later
        payment.
      </p>
      <label className="block space-y-1.5">
        <span className={labelClass}>Paid so far (MMK)</span>
        <input
          type="number"
          min="0"
          step="1"
          className={fieldClass}
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </label>
      <p className="text-sm tabular-nums text-[var(--muted)]">
        Left after this save: {formatMmk(left)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondaryClass} disabled={pending} onClick={() => save(0)}>
          Nothing yet
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={pending}
          onClick={() => save(Math.round(totalMmk * 0.3))}
        >
          30%
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={pending}
          onClick={() => save(Math.round(totalMmk / 2))}
        >
          Half
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={pending}
          onClick={() => save(totalMmk)}
        >
          Paid in full
        </button>
        <button
          type="button"
          className={btnPrimaryClass}
          disabled={pending}
          onClick={() => save(amount)}
        >
          {pending ? "Saving…" : "Save paid amount"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
