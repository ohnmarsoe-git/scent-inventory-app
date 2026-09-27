export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export function actionError(error: unknown, fallback: string): ActionResult {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (message.includes("duplicate key") || message.includes("unique")) {
      return { ok: false, error: "A record with this name already exists." };
    }
    if (
      message.includes("schema cache") ||
      message.includes("Could not find the function")
    ) {
      return {
        ok: false,
        error:
          "Database function missing. In Supabase SQL Editor, run supabase/migrations/20260918180000_sale_order_auto_decant.sql, then try again.",
      };
    }
    return { ok: false, error: message || fallback };
  }
  return { ok: false, error: fallback };
}
