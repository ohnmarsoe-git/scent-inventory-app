"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validations/sales";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return supabase;
}

function revalidateCustomers() {
  revalidatePath("/sales/customers");
  revalidatePath("/sales");
}

export async function findOrCreateCustomerByName(
  nameInput: string,
): Promise<ActionResult & { name?: string }> {
  try {
    const name = nameInput.trim();
    if (!name) return { ok: false, error: "Customer name is required." };

    const supabase = await requireUser();
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name")
      .ilike("name", name)
      .eq("is_active", true)
      .limit(10);

    const exact = (existing ?? []).find(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (exact) return { ok: true, id: exact.id, name: exact.name };

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name,
        phone: null,
        messenger_contact: null,
        notes: null,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (error) return actionError(error, "Could not create customer.");
    revalidateCustomers();
    revalidatePath("/sales/orders/new");
    return { ok: true, id: data.id, name: data.name };
  } catch (error) {
    return actionError(error, "Could not save customer.");
  }
}

export async function createCustomer(input: unknown): Promise<ActionResult> {
  try {
    const parsed = customerSchema.parse(input);
    const supabase = await requireUser();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: parsed.name,
        phone: parsed.phone ?? null,
        messenger_contact: parsed.messenger_contact ?? null,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();
    if (error) return actionError(error, "Could not create customer.");
    revalidateCustomers();
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error, "Could not create customer.");
  }
}

export async function updateCustomer(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = customerSchema.parse(input);
    const supabase = await requireUser();
    const { error } = await supabase
      .from("customers")
      .update({
        name: parsed.name,
        phone: parsed.phone ?? null,
        messenger_contact: parsed.messenger_contact ?? null,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .eq("id", id);
    if (error) return actionError(error, "Could not update customer.");
    revalidateCustomers();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update customer.");
  }
}

export async function setCustomerActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("customers")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) return actionError(error, "Could not update customer status.");
    revalidateCustomers();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update customer status.");
  }
}
