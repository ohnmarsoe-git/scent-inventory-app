"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";

export async function updateAppSettings(input: {
  allow_negative_stock: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("You must be signed in.");

    const { error } = await supabase
      .from("app_settings")
      .update({ allow_negative_stock: Boolean(input.allow_negative_stock) })
      .eq("id", 1);

    if (error) return actionError(error, "Could not update settings.");
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return actionError(error, "Could not update settings.");
  }
}
