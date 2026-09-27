"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { perfumeSchema } from "@/lib/validations/masters";

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

export async function createPerfume(input: unknown): Promise<ActionResult> {
  try {
    const parsed = perfumeSchema.parse(input);
    const supabase = await requireUser();
    const { data, error } = await supabase
      .from("perfumes")
      .insert({
        brand_id: parsed.brand_id,
        name: parsed.name,
        product_type: parsed.product_type,
        default_bottle_size_ml: parsed.default_bottle_size_ml,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();

    if (error) return actionError(error, "Could not create perfume.");
    revalidatePath("/inventory/perfumes");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error, "Could not create perfume.");
  }
}

export async function updatePerfume(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = perfumeSchema.parse(input);
    const supabase = await requireUser();
    const { error } = await supabase
      .from("perfumes")
      .update({
        brand_id: parsed.brand_id,
        name: parsed.name,
        product_type: parsed.product_type,
        default_bottle_size_ml: parsed.default_bottle_size_ml,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .eq("id", id);

    if (error) return actionError(error, "Could not update perfume.");
    revalidatePath("/inventory/perfumes");
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update perfume.");
  }
}

export async function setPerfumeActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("perfumes")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) return actionError(error, "Could not update perfume status.");
    revalidatePath("/inventory/perfumes");
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update perfume status.");
  }
}
