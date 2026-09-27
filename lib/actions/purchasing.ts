"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  purchaseOrderSchema,
  receivePurchaseOrderSchema,
} from "@/lib/validations/purchasing";

function revalidatePurchasing() {
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/orders");
  revalidatePath("/purchasing/receiving");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/movements");
  revalidatePath("/");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be signed in.");
  }
  return supabase;
}

async function saveDeposit(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  id: string,
  paidMmk: number,
): Promise<ActionResult> {
  const paid = Number(paidMmk);
  if (!Number.isFinite(paid) || paid < 0) {
    return { ok: false, error: "Paid amount cannot be negative." };
  }

  const { data: order, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id, total_mmk, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    return actionError(
      fetchError,
      "Could not save the deposit. Run 20260919140000_po_deposit.sql in Supabase.",
    );
  }
  if (!order) return { ok: false, error: "Purchase order not found." };
  if (order.status === "cancelled") {
    return { ok: false, error: "This order is cancelled." };
  }
  if (paid > Number(order.total_mmk) + 0.009) {
    return { ok: false, error: "Paid amount cannot be more than the order total." };
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ deposit_paid_mmk: Math.round(paid * 100) / 100 })
    .eq("id", id);
  if (error) {
    return actionError(
      error,
      "Could not save the deposit. Run 20260919140000_po_deposit.sql in Supabase.",
    );
  }
  return { ok: true, id };
}

/** Total MMK already paid on this order. Balance due is total minus this. */
export async function setPurchaseOrderDeposit(
  id: string,
  paidMmk: number,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const saved = await saveDeposit(supabase, id, paidMmk);
    if (!saved.ok) return saved;
    revalidatePurchasing();
    revalidatePath(`/purchasing/orders/${id}`);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not save the deposit.");
  }
}

function toPoRpcArgs(parsed: ReturnType<typeof purchaseOrderSchema.parse>) {
  return {
    p_supplier_id: parsed.supplier_id,
    p_order_date: parsed.order_date,
    p_expected_arrival_date: parsed.expected_arrival_date || null,
    p_currency: parsed.currency,
    p_exchange_rate: parsed.exchange_rate,
    p_shipping_cost_original: parsed.shipping_cost_original,
    p_other_cost_original: parsed.other_cost_original,
    p_notes: parsed.notes || null,
    p_lines: parsed.lines.map((line) => ({
      perfume_id: line.perfume_id,
      bottle_size_ml: line.bottle_size_ml,
      quantity: line.quantity,
      unit_cost_original: line.unit_cost_original,
      notes: line.notes || null,
    })),
  };
}

export async function createPurchaseOrder(input: unknown): Promise<ActionResult> {
  try {
    const parsed = purchaseOrderSchema.parse(input);
    const supabase = await requireUser();
    const { data, error } = await supabase.rpc(
      "create_purchase_order",
      toPoRpcArgs(parsed),
    );

    if (error) return actionError(error, "Could not create purchase order.");
    const saved = await saveDeposit(supabase, data as string, parsed.deposit_paid_mmk);
    if (!saved.ok) return saved;
    revalidatePurchasing();
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not create purchase order.");
  }
}

export async function updateDraftPurchaseOrder(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = purchaseOrderSchema.parse(input);
    const supabase = await requireUser();
    const args = toPoRpcArgs(parsed);
    const { data, error } = await supabase.rpc("update_draft_purchase_order", {
      p_purchase_order_id: id,
      ...args,
    });

    if (error) return actionError(error, "Could not update purchase order.");
    const saved = await saveDeposit(supabase, id, parsed.deposit_paid_mmk);
    if (!saved.ok) return saved;
    revalidatePurchasing();
    revalidatePath(`/purchasing/orders/${id}`);
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not update purchase order.");
  }
}

export async function markPurchaseOrderOrdered(
  id: string,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase.rpc("set_purchase_order_status", {
      p_purchase_order_id: id,
      p_status: "ordered",
    });
    if (error) return actionError(error, "Could not mark PO as ordered.");
    revalidatePurchasing();
    revalidatePath(`/purchasing/orders/${id}`);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not mark PO as ordered.");
  }
}

export async function cancelPurchaseOrder(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase.rpc("set_purchase_order_status", {
      p_purchase_order_id: id,
      p_status: "cancelled",
    });
    if (error) return actionError(error, "Could not cancel purchase order.");
    revalidatePurchasing();
    revalidatePath(`/purchasing/orders/${id}`);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not cancel purchase order.");
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function receivePurchaseOrder(input: unknown): Promise<ActionResult> {
  try {
    const parsed = receivePurchaseOrderSchema.parse(input);
    const lines = parsed.lines.filter((l) => l.quantity_bottles > 0);
    if (lines.length === 0) {
      return { ok: false, error: "Enter a receive quantity on at least one line." };
    }

    const supabase = await requireUser();
    const { data: order, error: fetchError } = await supabase
      .from("purchase_orders")
      .select(
        "id, exchange_rate, subtotal_mmk, subtotal_original, shipping_cost_mmk, shipping_cost_original, other_cost_mmk, other_cost_original, total_mmk, total_original",
      )
      .eq("id", parsed.purchase_order_id)
      .maybeSingle();
    if (fetchError) return actionError(fetchError, "Could not load this purchase order.");
    if (!order) return { ok: false, error: "Purchase order not found." };

    const rate = Number(order.exchange_rate);
    if (!(rate > 0)) return { ok: false, error: "Exchange rate is invalid." };

    const shipping = roundMoney(parsed.shipping_cost_mmk);
    const other = roundMoney(parsed.other_cost_mmk);
    const shippingOriginal = roundMoney(shipping / rate);
    const otherOriginal = roundMoney(other / rate);
    const previousCosts = {
      shipping_cost_mmk: Number(order.shipping_cost_mmk),
      shipping_cost_original: Number(order.shipping_cost_original),
      other_cost_mmk: Number(order.other_cost_mmk),
      other_cost_original: Number(order.other_cost_original),
      total_mmk: Number(order.total_mmk),
      total_original: Number(order.total_original),
    };
    const nextCosts = {
      shipping_cost_mmk: shipping,
      shipping_cost_original: shippingOriginal,
      other_cost_mmk: other,
      other_cost_original: otherOriginal,
      total_mmk: roundMoney(Number(order.subtotal_mmk) + shipping + other),
      total_original: roundMoney(
        Number(order.subtotal_original) + shippingOriginal + otherOriginal,
      ),
    };

    const { error: costError } = await supabase
      .from("purchase_orders")
      .update(nextCosts)
      .eq("id", parsed.purchase_order_id);
    if (costError) return actionError(costError, "Could not update shipping and other costs.");

    const { data, error } = await supabase.rpc("receive_purchase_order", {
      p_purchase_order_id: parsed.purchase_order_id,
      p_lines: lines.map((l) => ({
        purchase_order_item_id: l.purchase_order_item_id,
        quantity_bottles: l.quantity_bottles,
      })),
      p_notes: parsed.notes || null,
    });

    if (error) {
      await supabase
        .from("purchase_orders")
        .update(previousCosts)
        .eq("id", parsed.purchase_order_id);
      return actionError(error, "Could not receive stock.");
    }

    const receiptId = data as string;
    const { error: dateError } = await supabase
      .from("purchase_receipts")
      .update({ received_at: `${parsed.received_on}T00:00:00+06:30` })
      .eq("id", receiptId);
    if (dateError) {
      revalidatePurchasing();
      revalidatePath(`/purchasing/orders/${parsed.purchase_order_id}`);
      return {
        ok: false,
        error:
          "Stock was received, but the receiving date could not be saved. Do not receive again.",
      };
    }

    const { data: updated, error: statusError } = await supabase
      .from("purchase_orders")
      .select("status")
      .eq("id", parsed.purchase_order_id)
      .maybeSingle();
    if (statusError) {
      revalidatePurchasing();
      revalidatePath(`/purchasing/orders/${parsed.purchase_order_id}`);
      return {
        ok: false,
        error:
          "Stock was received, but the order could not be confirmed. Do not receive again.",
      };
    }

    if (updated?.status === "received") {
      const { error: paidError } = await supabase
        .from("purchase_orders")
        .update({ deposit_paid_mmk: nextCosts.total_mmk })
        .eq("id", parsed.purchase_order_id);
      if (paidError) {
        revalidatePurchasing();
        revalidatePath(`/purchasing/orders/${parsed.purchase_order_id}`);
        return {
          ok: false,
          error:
            "Stock was received, but the amount left to pay was not saved as paid. Do not receive again.",
        };
      }
    }

    revalidatePurchasing();
    revalidatePath(`/purchasing/orders/${parsed.purchase_order_id}`);
    return { ok: true, id: receiptId };
  } catch (error) {
    return actionError(error, "Could not receive stock.");
  }
}
