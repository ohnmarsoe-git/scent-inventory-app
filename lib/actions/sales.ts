"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  createSaleOrderSchema,
  recordPaymentSchema,
  updateSaleOrderSchema,
} from "@/lib/validations/sales";

function revalidateSales(saleId?: string) {
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath("/sales/payments");
  revalidatePath("/sales/customers");
  revalidatePath("/inventory/decants");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/movements");
  revalidatePath("/");
  if (saleId) revalidatePath(`/sales/orders/${saleId}`);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return supabase;
}

function saleNotes(
  notes: string | null | undefined,
  hasCap: boolean,
): string | null {
  const parts = [
    notes?.trim() || "",
    hasCap ? "Cap bottle" : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function toSaleLines(
  lines: Array<{
    perfume_id: string;
    size_ml: number;
    quantity: number;
    unit_sale_price_mmk: number;
    line_discount_mmk?: number;
    with_cap?: boolean;
    cap_extra_mmk?: number;
  }>,
) {
  return lines.map((line) => ({
    perfume_id: line.perfume_id,
    size_ml: line.size_ml,
    quantity: line.quantity,
    unit_sale_price_mmk: line.unit_sale_price_mmk,
    line_discount_mmk: Number(line.line_discount_mmk) || 0,
    with_cap: Boolean(line.with_cap),
    cap_extra_mmk: line.with_cap ? Number(line.cap_extra_mmk) || 0 : 0,
  }));
}

export async function createSale(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createSaleOrderSchema.parse({
      ...(input as object),
      customer_id:
        (input as { customer_id?: string | null })?.customer_id || null,
    });
    const supabase = await requireUser();
    const hasCap = parsed.lines.some((line) => line.with_cap);

    const { data, error } = await supabase.rpc("create_sale_order", {
      p_customer_id: parsed.customer_id || null,
      p_sale_date: parsed.sale_date,
      p_notes: saleNotes(parsed.notes, hasCap),
      p_lines: toSaleLines(parsed.lines),
      p_pay_now: parsed.pay_now,
      p_payment_method: parsed.payment_method,
      p_discount_mmk: Number(parsed.discount_mmk) || 0,
    });

    if (error) return actionError(error, "Could not create sale.");
    revalidateSales(data as string);
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not create sale.");
  }
}

export async function updateSale(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateSaleOrderSchema.parse({
      ...(input as object),
      customer_id:
        (input as { customer_id?: string | null })?.customer_id || null,
    });
    const supabase = await requireUser();
    const hasCap = parsed.lines.some((line) => line.with_cap);

    const { data, error } = await supabase.rpc("update_sale_order", {
      p_sale_id: parsed.sale_id,
      p_customer_id: parsed.customer_id || null,
      p_sale_date: parsed.sale_date,
      p_notes: saleNotes(parsed.notes, hasCap),
      p_lines: toSaleLines(parsed.lines),
      p_discount_mmk: Number(parsed.discount_mmk) || 0,
    });

    if (error) {
      return actionError(
        error,
        "Could not update sale. In Supabase SQL Editor, run supabase/migrations/20261031180000_sale_edit_and_discounts.sql",
      );
    }
    revalidateSales(parsed.sale_id);
    revalidatePath(`/sales/orders/${parsed.sale_id}/edit`);
    return { ok: true, id: (data as string) || parsed.sale_id };
  } catch (error) {
    return actionError(error, "Could not update sale.");
  }
}

export async function reverseOverpayment(saleId: string): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { data: sale, error } = await supabase
      .from("sales")
      .select("id, total_mmk, paid_amount_mmk")
      .eq("id", saleId)
      .maybeSingle();
    if (error || !sale) return actionError(error, "Sale not found.");

    const total = Number(sale.total_mmk);
    const excess =
      Math.round((Number(sale.paid_amount_mmk) - total) * 100) / 100;
    if (excess <= 0) return { ok: true, id: saleId };

    const { error: saleError } = await supabase
      .from("sales")
      .update({
        paid_amount_mmk: total,
        remaining_amount_mmk: 0,
        payment_status: "paid",
      })
      .eq("id", saleId);
    if (saleError) return actionError(saleError, "Could not update the sale.");

    const { data: payments, error: payError } = await supabase
      .from("payments")
      .select("id, amount_mmk")
      .eq("sale_id", saleId)
      .order("created_at", { ascending: false });
    if (payError) return actionError(payError, "Could not load payments.");

    let left = excess;
    for (const payment of payments ?? []) {
      if (left <= 0.001) break;
      const amount = Number(payment.amount_mmk);
      if (amount <= left + 0.001) {
        const { error: deleteError } = await supabase
          .from("payments")
          .delete()
          .eq("id", payment.id);
        if (deleteError) {
          return actionError(deleteError, "Could not reverse the extra payment.");
        }
        left = Math.round((left - amount) * 100) / 100;
      } else {
        const nextAmount = Math.round((amount - left) * 100) / 100;
        const { error: updateError } = await supabase
          .from("payments")
          .update({ amount_mmk: nextAmount })
          .eq("id", payment.id);
        if (updateError) {
          return actionError(updateError, "Could not reverse the extra payment.");
        }
        left = 0;
      }
    }

    return { ok: true, id: saleId };
  } catch (error) {
    return actionError(error, "Could not reverse the extra payment.");
  }
}

export async function recordPayment(input: unknown): Promise<ActionResult> {
  try {
    const parsed = recordPaymentSchema.parse(input);
    const supabase = await requireUser();
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("remaining_amount_mmk, is_voided")
      .eq("id", parsed.sale_id)
      .maybeSingle();
    if (saleError || !sale) return actionError(saleError, "Sale not found.");
    if (sale.is_voided) {
      return { ok: false, error: "Cannot pay a voided sale." };
    }
    const remaining = Number(sale.remaining_amount_mmk);
    if (remaining <= 0) {
      return { ok: false, error: "This sale is already paid." };
    }
    if (parsed.amount_mmk > remaining + 0.001) {
      return {
        ok: false,
        error: "Payment cannot be more than the amount still owed.",
      };
    }

    const { data, error } = await supabase.rpc("record_sale_payment", {
      p_sale_id: parsed.sale_id,
      p_amount_mmk: parsed.amount_mmk,
      p_payment_method: parsed.payment_method,
      p_payment_date: parsed.payment_date,
      p_notes: parsed.notes || null,
    });

    if (error) return actionError(error, "Could not record payment.");
    revalidateSales(parsed.sale_id);
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not record payment.");
  }
}
