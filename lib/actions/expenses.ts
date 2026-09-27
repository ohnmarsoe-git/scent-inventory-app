"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validations/expenses";

function revalidateExpenses() {
  revalidatePath("/expenses");
  revalidatePath("/expenses/pnl");
  revalidatePath("/");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return supabase;
}

function toRpcArgs(parsed: ReturnType<typeof expenseSchema.parse>) {
  return {
    p_expense_date: parsed.expense_date,
    p_category_id: parsed.category_id,
    p_description: parsed.description,
    p_amount_mmk: parsed.amount_mmk,
    p_payment_method: parsed.payment_method,
    p_related_purchase_order_id: parsed.related_purchase_order_id || null,
    p_notes: parsed.notes || null,
  };
}

export async function createExpense(input: unknown): Promise<ActionResult> {
  try {
    const parsed = expenseSchema.parse({
      ...(input as object),
      related_purchase_order_id:
        (input as { related_purchase_order_id?: string | null })
          ?.related_purchase_order_id || null,
    });
    const supabase = await requireUser();
    const { data, error } = await supabase.rpc("create_expense", toRpcArgs(parsed));
    if (error) return actionError(error, "Could not create expense.");
    revalidateExpenses();
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not create expense.");
  }
}

export async function updateExpense(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = expenseSchema.parse({
      ...(input as object),
      related_purchase_order_id:
        (input as { related_purchase_order_id?: string | null })
          ?.related_purchase_order_id || null,
    });
    const supabase = await requireUser();
    const { data, error } = await supabase.rpc("update_expense", {
      p_expense_id: id,
      ...toRpcArgs(parsed),
    });
    if (error) return actionError(error, "Could not update expense.");
    revalidateExpenses();
    revalidatePath(`/expenses/${id}/edit`);
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not update expense.");
  }
}
