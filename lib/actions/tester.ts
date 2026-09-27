"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { recordTesterSchema } from "@/lib/validations/tester";

function revalidateTester() {
  revalidatePath("/inventory/testers");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/movements");
  revalidatePath("/inventory");
  revalidatePath("/expenses/pnl");
  revalidatePath("/");
}

export async function recordTester(input: unknown): Promise<ActionResult> {
  try {
    const parsed = recordTesterSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("You must be signed in.");

    const { data, error } = await supabase.rpc("record_perfume_sample", {
      p_perfume_id: parsed.perfume_id,
      p_size_ml: parsed.size_ml,
      p_quantity: parsed.quantity,
      p_notes: parsed.notes || null,
    });

    if (error) {
      const message = error.message ?? "";
      if (
        message.includes("Could not find the function") ||
        message.includes("schema cache")
      ) {
        return {
          ok: false,
          error:
            "Database function missing. In Supabase SQL Editor, run supabase/migrations/20260920140000_perfume_sample.sql, then try again.",
        };
      }
      return actionError(error, "Could not record the tester.");
    }

    revalidateTester();
    return { ok: true, id: data as string };
  } catch (error) {
    return actionError(error, "Could not record the tester.");
  }
}
