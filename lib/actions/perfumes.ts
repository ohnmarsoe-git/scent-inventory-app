"use server";

import { revalidatePath } from "next/cache";

import { findOrCreateBrandByName } from "@/lib/actions/brands";
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

function revalidatePerfumes() {
  revalidatePath("/inventory/perfumes");
  revalidatePath("/inventory/brands");
  revalidatePath("/inventory");
  revalidatePath("/sales/price-list");
  revalidatePath("/sales/orders/new");
}

async function resolveBrandId(input: {
  brand_id?: string | null;
  brand_name: string;
}): Promise<ActionResult> {
  const name = input.brand_name.trim();
  if (!name) return { ok: false, error: "Brand is required." };

  if (input.brand_id) {
    const supabase = await requireUser();
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name")
      .eq("id", input.brand_id)
      .maybeSingle();
    if (
      brand &&
      brand.name.trim().toLowerCase() === name.toLowerCase()
    ) {
      return { ok: true, id: brand.id };
    }
  }

  return findOrCreateBrandByName(name);
}

export async function createPerfume(input: unknown): Promise<ActionResult> {
  try {
    const parsed = perfumeSchema.parse(input);
    const brand = await resolveBrandId(parsed);
    if (!brand.ok || !brand.id) return brand;

    const supabase = await requireUser();
    const { data, error } = await supabase
      .from("perfumes")
      .insert({
        brand_id: brand.id,
        name: parsed.name,
        product_type: parsed.product_type,
        default_bottle_size_ml: parsed.default_bottle_size_ml,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();

    if (error) return actionError(error, "Could not create perfume.");
    revalidatePerfumes();
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
    const brand = await resolveBrandId(parsed);
    if (!brand.ok || !brand.id) return brand;

    const supabase = await requireUser();
    const { error } = await supabase
      .from("perfumes")
      .update({
        brand_id: brand.id,
        name: parsed.name,
        product_type: parsed.product_type,
        default_bottle_size_ml: parsed.default_bottle_size_ml,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .eq("id", id);

    if (error) return actionError(error, "Could not update perfume.");
    revalidatePerfumes();
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
    revalidatePerfumes();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update perfume status.");
  }
}
