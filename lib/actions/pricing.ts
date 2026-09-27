"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import { upsertPriceListSchema, priceListCostBasisSchema } from "@/lib/validations/pricing";
import { PRICE_LIST_SIZES } from "@/lib/domain/pricing";

function revalidatePricing() {
  revalidatePath("/sales/price-list");
  revalidatePath("/sales/orders/new");
  revalidatePath("/sales");
  revalidatePath("/inventory/stock");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return supabase;
}

/** Upsert price list cells and sync matching DECANT inventory list_price_mmk. */
export async function upsertPriceList(
  input: unknown,
): Promise<ActionResult & { updated?: number }> {
  try {
    const parsed = upsertPriceListSchema.parse(input);
    const supabase = await requireUser();
    let updated = 0;

    for (const cell of parsed.cells) {
      if (cell.sell_price_mmk <= 0) {
        // Clear / delete zero prices
        await supabase
          .from("price_list_entries")
          .delete()
          .eq("perfume_id", cell.perfume_id)
          .eq("size_ml", cell.size_ml);

        await supabase
          .from("inventory_items")
          .update({ list_price_mmk: null })
          .eq("item_type", "DECANT")
          .eq("perfume_id", cell.perfume_id)
          .eq("size_ml", cell.size_ml);
        continue;
      }

      const { error } = await supabase.from("price_list_entries").upsert(
        {
          perfume_id: cell.perfume_id,
          size_ml: cell.size_ml,
          sell_price_mmk: cell.sell_price_mmk,
          is_active: true,
        },
        { onConflict: "perfume_id,size_ml" },
      );
      if (error) return actionError(error, "Could not save price list.");

      await supabase
        .from("inventory_items")
        .update({ list_price_mmk: cell.sell_price_mmk })
        .eq("item_type", "DECANT")
        .eq("perfume_id", cell.perfume_id)
        .eq("size_ml", cell.size_ml);

      updated++;
    }

    revalidatePricing();
    return { ok: true, updated };
  } catch (error) {
    return actionError(error, "Could not save price list.");
  }
}

export async function setInventoryListPrice(
  inventoryItemId: string,
  listPriceMmk: number | null,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const price =
      listPriceMmk == null || !Number.isFinite(listPriceMmk) || listPriceMmk <= 0
        ? null
        : listPriceMmk;

    const { data: item, error: fetchError } = await supabase
      .from("inventory_items")
      .select("id, item_type, perfume_id, size_ml")
      .eq("id", inventoryItemId)
      .maybeSingle();
    if (fetchError) return actionError(fetchError, "Could not load stock item.");
    if (!item) return { ok: false, error: "Stock item not found." };

    const { error } = await supabase
      .from("inventory_items")
      .update({ list_price_mmk: price })
      .eq("id", inventoryItemId);
    if (error) return actionError(error, "Could not update list price.");

    if (
      item.item_type === "DECANT" &&
      item.perfume_id &&
      item.size_ml != null
    ) {
      if (price == null) {
        await supabase
          .from("price_list_entries")
          .delete()
          .eq("perfume_id", item.perfume_id)
          .eq("size_ml", item.size_ml);
      } else {
        await supabase.from("price_list_entries").upsert(
          {
            perfume_id: item.perfume_id,
            size_ml: item.size_ml,
            sell_price_mmk: price,
            is_active: true,
          },
          { onConflict: "perfume_id,size_ml" },
        );
      }
    }

    revalidatePricing();
    return { ok: true, id: inventoryItemId };
  } catch (error) {
    return actionError(error, "Could not update list price.");
  }
}

/** Save which items count as tools, and the normal bottle price for each decant size. */
export async function savePriceListCosts(
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = priceListCostBasisSchema.parse(input);
    const supabase = await requireUser();
    const bottles: Record<string, number> = {};
    for (const size of PRICE_LIST_SIZES) {
      const value = parsed.bottles[size];
      if (value > 0) bottles[String(size)] = Math.round(value);
    }

    const { error } = await supabase
      .from("app_settings")
      .update({
        normal_bottle_mmk: bottles,
        price_list_tool_ids: parsed.tool_ids,
      })
      .eq("id", 1);

    if (error) {
      const message = error.message ?? "";
      if (
        message.includes("normal_bottle_mmk") ||
        message.includes("price_list_tool_ids")
      ) {
        return {
          ok: false,
          error:
            "Cost settings are not in the database yet. In the Supabase SQL editor, run supabase/migrations/20260920250000_price_list_cost_basis.sql, then save again.",
        };
      }
      return actionError(error, "Could not save cost settings.");
    }
    revalidatePricing();
    return { ok: true };
  } catch (error) {
    return actionError(error, "Could not save cost settings.");
  }
}
