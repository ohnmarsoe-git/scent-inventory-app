"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  createSaleOrderSchema,
  createSaleSchema,
  recordPaymentSchema,
} from "@/lib/validations/sales";

function revalidateSales(saleId?: string) {
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath("/sales/payments");
  revalidatePath("/sales/customers");
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

export async function createSale(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createSaleSchema.parse({
      ...(input as object),
      customer_id:
        (input as { customer_id?: string | null })?.customer_id || null,
    });
    const supabase = await requireUser();

    const initialPayment =
      parsed.initial_payment_amount > 0
        ? {
            amount_mmk: parsed.initial_payment_amount,
            payment_method: parsed.initial_payment_method,
            notes: null,
          }
        : null;

    const { data, error } = await supabase.rpc("create_sale", {
      p_customer_id: parsed.customer_id || null,
      p_sale_date: parsed.sale_date,
      p_discount_mmk: parsed.discount_mmk,
      p_notes: parsed.notes || null,
      p_lines: parsed.lines.map((line) => ({
        inventory_item_id: line.inventory_item_id,
        quantity: line.quantity,
        unit_sale_price_mmk: line.unit_sale_price_mmk,
        line_discount_mmk: line.line_discount_mmk ?? 0,
      })),
      p_initial_payment: initialPayment,
    });

    if (error) return actionError(error, "Could not create sale.");
    revalidateSales(data as string);
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not create sale.");
  }
}

/** Order Tracking style: perfume + size → auto-deduct liquid on confirm. */
export async function createSaleOrder(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createSaleOrderSchema.parse({
      ...(input as object),
      customer_id:
        (input as { customer_id?: string | null })?.customer_id || null,
    });
    const supabase = await requireUser();

    const initialPayment =
      parsed.initial_payment_amount > 0
        ? {
            amount_mmk: parsed.initial_payment_amount,
            payment_method: parsed.initial_payment_method,
            notes: null,
          }
        : null;

    const { data, error } = await supabase.rpc("create_sale_order", {
      p_customer_id: parsed.customer_id || null,
      p_sale_date: parsed.sale_date,
      p_discount_mmk: parsed.discount_mmk,
      p_notes: parsed.notes || null,
      p_lines: parsed.lines.map((line) => ({
        perfume_id: line.perfume_id,
        size_ml: line.size_ml,
        quantity: line.quantity,
        unit_sale_price_mmk: line.unit_sale_price_mmk,
        line_discount_mmk: line.line_discount_mmk ?? 0,
      })),
      p_initial_payment: initialPayment,
    });

    if (error) return actionError(error, "Could not create sale order.");
    revalidateSales(data as string);
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not create sale order.");
  }
}

export async function recordPayment(input: unknown): Promise<ActionResult> {
  try {
    const parsed = recordPaymentSchema.parse(input);
    const supabase = await requireUser();
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
