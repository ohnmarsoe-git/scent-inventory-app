"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { bundleSetSchema } from "@/lib/validations/bundles";

function revalidateBundles(id?: string) {
  revalidatePath("/sales/bundles");
  revalidatePath("/sales");
  revalidatePath("/sales/orders/new");
  if (id) revalidatePath(`/sales/bundles/${id}/edit`);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return supabase;
}

function missingTableMessage(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (
    message.includes("bundle_sets") ||
    message.includes("bundle_set_items") ||
    message.includes("schema cache")
  ) {
    return "Bundle tables missing. In Supabase SQL Editor, run supabase/migrations/20261031150000_bundle_sets.sql, then try again.";
  }
  return null;
}

function uniquePerfumeItems(
  items: Array<{ perfume_id: string; quantity: number }>,
) {
  const byPerfume = new Map<string, number>();
  for (const item of items) {
    byPerfume.set(
      item.perfume_id,
      (byPerfume.get(item.perfume_id) ?? 0) + item.quantity,
    );
  }
  return [...byPerfume.entries()].map(([perfume_id, quantity], index) => ({
    perfume_id,
    quantity,
    sort_order: index,
  }));
}

export async function createBundleSet(input: unknown): Promise<ActionResult> {
  try {
    const parsed = bundleSetSchema.parse(input);
    const items = uniquePerfumeItems(parsed.items);
    const supabase = await requireUser();

    const { data, error } = await supabase
      .from("bundle_sets")
      .insert({
        name: parsed.name,
        size_ml: parsed.size_ml,
        sale_price_mmk: parsed.sale_price_mmk,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();

    if (error) {
      const missing = missingTableMessage(error);
      if (missing) return { ok: false, error: missing };
      return actionError(error, "Could not create bundle set.");
    }

    const { error: itemsError } = await supabase.from("bundle_set_items").insert(
      items.map((item) => ({
        bundle_set_id: data.id,
        perfume_id: item.perfume_id,
        quantity: item.quantity,
        sort_order: item.sort_order,
      })),
    );

    if (itemsError) {
      await supabase.from("bundle_sets").delete().eq("id", data.id);
      return actionError(itemsError, "Could not save bundle perfumes.");
    }

    revalidateBundles(data.id);
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error, "Could not create bundle set.");
  }
}

export async function updateBundleSet(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = bundleSetSchema.parse(input);
    const items = uniquePerfumeItems(parsed.items);
    const supabase = await requireUser();

    const { error } = await supabase
      .from("bundle_sets")
      .update({
        name: parsed.name,
        size_ml: parsed.size_ml,
        sale_price_mmk: parsed.sale_price_mmk,
        notes: parsed.notes ?? null,
        is_active: parsed.is_active,
      })
      .eq("id", id);

    if (error) {
      const missing = missingTableMessage(error);
      if (missing) return { ok: false, error: missing };
      return actionError(error, "Could not update bundle set.");
    }

    const { error: deleteError } = await supabase
      .from("bundle_set_items")
      .delete()
      .eq("bundle_set_id", id);
    if (deleteError) {
      return actionError(deleteError, "Could not replace bundle perfumes.");
    }

    const { error: itemsError } = await supabase.from("bundle_set_items").insert(
      items.map((item) => ({
        bundle_set_id: id,
        perfume_id: item.perfume_id,
        quantity: item.quantity,
        sort_order: item.sort_order,
      })),
    );
    if (itemsError) {
      return actionError(itemsError, "Could not save bundle perfumes.");
    }

    revalidateBundles(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update bundle set.");
  }
}

export async function setBundleSetActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("bundle_sets")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      const missing = missingTableMessage(error);
      if (missing) return { ok: false, error: missing };
      return actionError(error, "Could not update bundle status.");
    }
    revalidateBundles(id);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update bundle status.");
  }
}
