"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { brandSchema } from "@/lib/validations/masters";

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

export async function createBrand(input: unknown): Promise<ActionResult> {
  try {
    const parsed = brandSchema.parse(input);
    const supabase = await requireUser();
    const { data, error } = await supabase
      .from("brands")
      .insert({
        name: parsed.name,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();

    if (error) return actionError(error, "Could not create brand.");
    revalidatePath("/inventory/brands");
    revalidatePath("/inventory/perfumes");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error, "Could not create brand.");
  }
}

export async function updateBrand(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = brandSchema.parse(input);
    const supabase = await requireUser();
    const { error } = await supabase
      .from("brands")
      .update({
        name: parsed.name,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .eq("id", id);

    if (error) return actionError(error, "Could not update brand.");
    revalidatePath("/inventory/brands");
    revalidatePath("/inventory/perfumes");
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update brand.");
  }
}

export async function setBrandActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("brands")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) return actionError(error, "Could not update brand status.");
    revalidatePath("/inventory/brands");
    revalidatePath("/inventory/perfumes");
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update brand status.");
  }
}
