"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { receivePurchaseOrder } from "@/lib/actions/purchasing";
import { moneyLeft } from "@/lib/domain/preorder";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import { receivePurchaseOrderSchema } from "@/lib/validations/purchasing";

export type ReceiveLineOption = {
  id: string;
  perfume_name: string;
  bottle_size_ml: number;
  quantity: number;
  received_quantity: number;
};

type ReceiveFormProps = {
  purchaseOrderId: string;
  lines: ReceiveLineOption[];
  subtotalMmk: number;
  shippingCostMmk: number;
  otherCostMmk: number;
  paidMmk: number;
};

type FormValues = {
  notes: string;
  received_on: string;
  shipping_cost_mmk: number;
  other_cost_mmk: number;
  quantities: Record<string, number>;
};

function todayInputDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ReceiveStockForm({
  purchaseOrderId,
  lines,
  subtotalMmk,
  shippingCostMmk,
  otherCostMmk,
  paidMmk,
}: ReceiveFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const defaultQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of lines) {
      map[line.id] = Math.max(0, line.quantity - line.received_quantity);
    }
    return map;
  }, [lines]);

  const { register, handleSubmit, control } = useForm<FormValues>({
    defaultValues: {
      notes: "",
      received_on: todayInputDate(),
      shipping_cost_mmk: shippingCostMmk,
      other_cost_mmk: otherCostMmk,
      quantities: defaultQuantities,
    },
  });

  const quantities = useWatch({ control, name: "quantities" });
  const shipping = useWatch({ control, name: "shipping_cost_mmk" });
  const other = useWatch({ control, name: "other_cost_mmk" });
  const orderTotal =
    subtotalMmk + (Number(shipping) || 0) + (Number(other) || 0);
  const leftToPay = moneyLeft(orderTotal, paidMmk);
  const finishesOrder = lines.every((line) => {
    const remaining = line.quantity - line.received_quantity;
    if (remaining <= 0) return true;
    return (Number(quantities?.[line.id]) || 0) >= remaining;
  });
  const hasPriorReceipt = lines.some((line) => line.received_quantity > 0);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const payload = {
      purchase_order_id: purchaseOrderId,
      received_on: values.received_on,
      shipping_cost_mmk: Number(values.shipping_cost_mmk) || 0,
      other_cost_mmk: Number(values.other_cost_mmk) || 0,
      notes: values.notes || null,
      lines: lines
        .map((line) => ({
          purchase_order_item_id: line.id,
          quantity_bottles: Math.trunc(Number(values.quantities[line.id]) || 0),
        }))
        .filter((l) => l.quantity_bottles > 0),
    };

    const parsed = receivePurchaseOrderSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? "Invalid receive form");
      return;
    }

    for (const line of parsed.data.lines) {
      const source = lines.find((l) => l.id === line.purchase_order_item_id);
      if (!source) continue;
      const remaining = source.quantity - source.received_quantity;
      if (line.quantity_bottles > remaining) {
        setServerError(
          `Cannot receive more than remaining for ${source.perfume_name} (remaining ${remaining}).`,
        );
        return;
      }
    }

    const result = await receivePurchaseOrder(parsed.data);
    if (!result.ok) {
      setServerError(result.error);
      if (result.error.includes("Do not receive again")) {
        setLocked(true);
      }
      return;
    }

    router.push(`/purchasing/orders/${purchaseOrderId}`);
    router.refresh();
  }

  const openLines = lines.filter((l) => l.received_quantity < l.quantity);
  if (locked) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push(`/purchasing/orders/${purchaseOrderId}`)}
        >
          Back to purchase order
        </button>
      </div>
    );
  }
  if (openLines.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Nothing left to receive on this purchase order.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <label className="block max-w-xs space-y-1.5">
        <span className={labelClass}>Receiving date</span>
        <input type="date" required className={fieldClass} {...register("received_on")} />
      </label>

      <div className="space-y-3">
        {openLines.map((line) => {
          const remaining = line.quantity - line.received_quantity;
          const qty = Number(quantities?.[line.id]) || 0;
          return (
            <div
              key={line.id}
              className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
            >
              <p className="font-medium text-[var(--ink)]">{line.perfume_name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {line.bottle_size_ml} ml · ordered {line.quantity} · received{" "}
                {line.received_quantity} · remaining {remaining}
              </p>
              <label className="mt-3 block max-w-xs space-y-1.5">
                <span className={labelClass}>Receive bottles</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  max={remaining}
                  inputMode="numeric"
                  className={fieldClass}
                  {...register(`quantities.${line.id}`, {
                    setValueAs: (v) => {
                      const n = Number(v);
                      return Number.isFinite(n) ? Math.trunc(n) : 0;
                    },
                  })}
                />
              </label>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Will add {qty * line.bottle_size_ml} ml to liquid stock
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={labelClass}>Shipping (MMK)</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className={fieldClass}
            {...register("shipping_cost_mmk", { valueAsNumber: true })}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Other costs (MMK)</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className={fieldClass}
            {...register("other_cost_mmk", { valueAsNumber: true })}
          />
        </label>
        <p className="text-sm text-[var(--muted)] sm:col-span-2">
          Order total {formatMmk(orderTotal)}. These amounts are saved on the
          purchase order and added into the cost of the bottles you receive now.
          {hasPriorReceipt
            ? " Earlier receipts already used the previous amounts."
            : ""}
          {finishesOrder
            ? leftToPay > 0
              ? ` Left to pay ${formatMmk(leftToPay)} is saved as paid.`
              : " This order is already paid in full."
            : " Left to pay is saved as paid when the order is fully received."}
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Notes</span>
        <textarea className={`${fieldClass} min-h-20`} {...register("notes")} />
      </label>

      {serverError ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={btnPrimaryClass}>
          Receive stock
        </button>
        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() => router.push(`/purchasing/orders/${purchaseOrderId}`)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
