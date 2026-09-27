"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { createDecantSchema } from "@/lib/validations/decant";

function revalidateDecant() {
  revalidatePath("/inventory/decants");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/movements");
  revalidatePath("/inventory");
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

export async function createDecant(input: unknown): Promise<ActionResult> {
  try {
    const parsed = createDecantSchema.parse(input);
    const supabase = await requireUser();

    const { data, error } = await supabase.rpc("create_decant_transaction", {
      p_perfume_id: parsed.perfume_id,
      p_notes: parsed.notes || null,
      p_outputs: parsed.outputs.map((out) => ({
        size_ml: out.size_ml,
        quantity: out.quantity,
        consumables: (out.consumables ?? [])
          .filter((c) => c.consumable_id)
          .map((c) => ({
            consumable_id: c.consumable_id,
            quantity_per_unit: c.quantity_per_unit ?? 1,
          })),
      })),
    });

    if (error) return actionError(error, "Could not create decant.");
    revalidateDecant();
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not create decant.");
  }
}
