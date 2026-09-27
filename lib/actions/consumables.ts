"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { createClient } from "@/lib/supabase/server";
import {
  consumableFormSchema,
  consumableReceiptSchema,
  normalizeConsumableInput,
} from "@/lib/validations/masters";

function revalidateConsumables() {
  revalidatePath("/inventory/consumables");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory/movements");
  revalidatePath("/sales/price-list");
  revalidatePath("/sales/orders/new");
}

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

export async function createConsumable(input: unknown): Promise<ActionResult> {
  try {
    const parsed = normalizeConsumableInput(consumableFormSchema.parse(input));
    const supabase = await requireUser();
    const { data, error } = await supabase
      .from("consumables")
      .insert({
        name: parsed.name,
        category: parsed.category,
        unit: parsed.unit,
        purchase_price_mmk: parsed.purchase_price_mmk,
        quantity_purchased: parsed.quantity_purchased,
        cost_per_unit_mmk: parsed.cost_per_unit_mmk,
        supplier_id: parsed.supplier_id,
        notes: parsed.notes,
        is_active: parsed.is_active,
      })
      .select("id")
      .single();

    if (error) return actionError(error, "Could not create consumable.");
    revalidateConsumables();
    return { ok: true, id: data.id };
  } catch (error) {
    return actionError(error, "Could not create consumable.");
  }
}

export async function updateConsumable(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = normalizeConsumableInput(consumableFormSchema.parse(input));
    const supabase = await requireUser();
    const [{ data: stock }, { data: current }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, avg_unit_cost_mmk, quantity_on_hand")
        .eq("item_type", "CONSUMABLE")
        .eq("consumable_id", id)
        .maybeSingle(),
      supabase
        .from("consumables")
        .select("purchase_price_mmk, quantity_purchased, cost_per_unit_mmk")
        .eq("id", id)
        .maybeSingle(),
    ]);

    const unitCost = parsed.cost_per_unit_mmk;
    const purchaseChanged =
      !current ||
      Number(current.purchase_price_mmk) !== parsed.purchase_price_mmk ||
      Number(current.quantity_purchased) !== parsed.quantity_purchased;
    const stockUnit = stock ? Number(stock.avg_unit_cost_mmk) : 0;
    const stockStillOpening =
      !!stock &&
      Number(stock.quantity_on_hand) === Number(parsed.quantity_purchased);
    const openingCostStale =
      stockStillOpening && Math.abs(stockUnit - unitCost) > 0.009;
    const writeUnit = !stock || purchaseChanged || openingCostStale;

    const { error } = await supabase
      .from("consumables")
      .update({
        name: parsed.name,
        category: parsed.category,
        unit: parsed.unit,
        purchase_price_mmk: parsed.purchase_price_mmk,
        quantity_purchased: parsed.quantity_purchased,
        ...(writeUnit ? { cost_per_unit_mmk: unitCost } : {}),
        supplier_id: parsed.supplier_id,
        notes: parsed.notes,
        is_active: parsed.is_active,
      })
      .eq("id", id);

    if (error) return actionError(error, "Could not update consumable.");

    if (stock && writeUnit) {
      const { error: stockError } = await supabase
        .from("inventory_items")
        .update({ avg_unit_cost_mmk: unitCost })
        .eq("id", stock.id);
      if (stockError) {
        return actionError(stockError, "Could not update the stock cost.");
      }
    }

    revalidateConsumables();
    revalidatePath(`/inventory/consumables/${id}/edit`);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update consumable.");
  }
}

export async function setConsumableActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("consumables")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) return actionError(error, "Could not update consumable status.");
    revalidateConsumables();
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not update consumable status.");
  }
}

export async function receiveConsumableStock(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = consumableReceiptSchema.parse(input);
    const supabase = await requireUser();

    const { data: consumable, error: loadError } = await supabase
      .from("consumables")
      .select("id, unit, quantity_purchased, cost_per_unit_mmk")
      .eq("id", id)
      .maybeSingle();
    if (loadError || !consumable) {
      return actionError(loadError, "Could not find that consumable.");
    }

    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id, quantity_on_hand, avg_unit_cost_mmk, unit")
      .eq("item_type", "CONSUMABLE")
      .eq("consumable_id", id)
      .maybeSingle();

    const openingQty = existing
      ? Number(existing.quantity_on_hand)
      : Number(consumable.quantity_purchased);
    const openingAvg = existing
      ? Number(existing.avg_unit_cost_mmk)
      : Number(consumable.cost_per_unit_mmk);
    const unitCost = parsed.total_mmk / parsed.quantity;
    const nextQty = openingQty + parsed.quantity;
    const nextAvg =
      nextQty > 0 ? (openingQty * openingAvg + parsed.quantity * unitCost) / nextQty : 0;

    let itemId = existing?.id;
    if (!itemId) {
      const { data: created, error: insertError } = await supabase
        .from("inventory_items")
        .insert({
          item_type: "CONSUMABLE",
          consumable_id: id,
          unit: consumable.unit,
          quantity_on_hand: nextQty,
          avg_unit_cost_mmk: nextAvg,
        })
        .select("id")
        .single();
      if (insertError || !created) {
        return actionError(insertError, "Could not add consumable stock.");
      }
      itemId = created.id;
      if (openingQty > 0) {
        await supabase.from("inventory_movements").insert({
          inventory_item_id: itemId,
          movement_type: "ADJUSTMENT_IN",
          quantity: openingQty,
          unit: consumable.unit,
          unit_cost_mmk: openingAvg,
          total_cost_mmk: Math.round(openingQty * openingAvg * 100) / 100,
          notes: "Opening consumable stock from master",
        });
      }
    } else {
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({
          quantity_on_hand: nextQty,
          avg_unit_cost_mmk: nextAvg,
        })
        .eq("id", itemId);
      if (updateError) {
        return actionError(updateError, "Could not add consumable stock.");
      }
    }

    const { error: moveError } = await supabase.from("inventory_movements").insert({
      inventory_item_id: itemId,
      movement_type: "PURCHASE_RECEIPT",
      quantity: parsed.quantity,
      unit: existing?.unit ?? consumable.unit,
      unit_cost_mmk: unitCost,
      total_cost_mmk: Math.round(parsed.total_mmk * 100) / 100,
      notes: "Consumable purchase",
    });
    if (moveError) return actionError(moveError, "Could not record the purchase.");

    const { error: costError } = await supabase
      .from("consumables")
      .update({ cost_per_unit_mmk: nextAvg })
      .eq("id", id);
    if (costError) return actionError(costError, "Could not update the bottle cost.");

    revalidateConsumables();
    revalidatePath(`/inventory/consumables/${id}/edit`);
    return { ok: true, id };
  } catch (error) {
    return actionError(error, "Could not add consumable stock.");
  }
}
