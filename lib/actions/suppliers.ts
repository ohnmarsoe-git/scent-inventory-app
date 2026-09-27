"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { supplierSchema } from "@/lib/validations/masters";

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

export async function createSupplier(input: unknown): Promise<ActionResult> {
  try {
    const parsed = supplierSchema.parse(input);
    const supabase = await requireUser();
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: parsed.name,
        phone: parsed.phone ?? null,
        contact: parsed.contact ?? null,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();

    if (error) return actionError(error, "Could not create supplier.");
    revalidatePath("/purchasing/suppliers");
    revalidatePath("/inventory/consumables");
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error, "Could not create supplier.");
  }
}

export async function updateSupplier(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = supplierSchema.parse(input);
    const supabase = await requireUser();
    const { error } = await supabase
      .from("suppliers")
      .update({
        name: parsed.name,
        phone: parsed.phone ?? null,
        contact: parsed.contact ?? null,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .eq("id", id);

    if (error) return actionError(error, "Could not update supplier.");
    revalidatePath("/purchasing/suppliers");
    revalidatePath("/inventory/consumables");
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update supplier.");
  }
}

export async function setSupplierActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) return actionError(error, "Could not update supplier status.");
    revalidatePath("/purchasing/suppliers");
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update supplier status.");
  }
}
