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

function revalidateCatalog() {
  revalidatePath("/inventory/brands");
  revalidatePath("/inventory/perfumes");
  revalidatePath("/inventory");
  revalidatePath("/purchasing/orders/new");
  revalidatePath("/sales/orders/new");
  revalidatePath("/sales/price-list");
}

export async function findOrCreateBrandByName(
  nameInput: string,
): Promise<ActionResult & { name?: string }> {
  try {
    const name = nameInput.trim();
    if (!name) return { ok: false, error: "Brand name is required." };

    const supabase = await requireUser();
    const { data: existing } = await supabase
      .from("brands")
      .select("id, name, is_active")
      .ilike("name", name)
      .limit(20);

    const exact = (existing ?? []).find(
      (b) => b.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (exact) {
      if (!exact.is_active) {
        const { error } = await supabase
          .from("brands")
          .update({ is_active: true })
          .eq("id", exact.id);
        if (error) return actionError(error, "Could not restore brand.");
        revalidateCatalog();
      }
      return { ok: true, id: exact.id, name: exact.name };
    }

    const { data, error } = await supabase
      .from("brands")
      .insert({
        name,
        notes: null,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (error) return actionError(error, "Could not create brand.");
    revalidateCatalog();
    return { ok: true, id: data.id, name: data.name };
  } catch (error) {
    return actionError(error, "Could not save brand.");
  }
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
    revalidateCatalog();
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
    revalidateCatalog();
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
    if (!isActive) {
      const { count, error: countError } = await supabase
        .from("perfumes")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", id)
        .eq("is_active", true);
      if (countError) {
        return actionError(countError, "Could not check brand perfumes.");
      }
      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error:
            "Archive or move this brand’s active perfumes first, then archive the brand.",
        };
      }
    }

    const { error } = await supabase
      .from("brands")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) return actionError(error, "Could not update brand status.");
    revalidateCatalog();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update brand status.");
  }
}

/** Hard-delete only when no perfumes reference the brand. */
export async function deleteBrand(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { count, error: countError } = await supabase
      .from("perfumes")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", id);
    if (countError) {
      return actionError(countError, "Could not check brand perfumes.");
    }
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "This brand still has perfumes. Archive or reassign them before deleting.",
      };
    }

    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) return actionError(error, "Could not delete brand.");
    revalidateCatalog();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not delete brand.");
  }
}
