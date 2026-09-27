import {
  capExtrasFromConsumables,
  isToolCandidate,
  liveUnitCost,
  packagingFromChoices,
  packagingFromConsumables,
  parseNormalBottles,
  resolveNormalBottles,
  type CapExtras,
  type ConsumableCostRow,
  type PackagingCosts,
  type PriceListSize,
  type ToolChoice,
} from "@/lib/domain/pricing";
import { createClient } from "@/lib/supabase/server";

export type PriceListCostSetup = {
  tools: ToolChoice[];
  selectedToolIds: string[];
  /** True after the user has saved normal bottle prices. */
  bottlesConfigured: boolean;
  /** Bottle prices used in the margin right now. */
  bottles: Partial<Record<PriceListSize, number>>;
  /** Stock bottle cost for that ml, shown so it can be replaced. */
  stockBottles: Partial<Record<PriceListSize, number>>;
};

type LoadedConsumable = ConsumableCostRow & { id: string };

/** Bottle and tools cost used for price-list margin and sale quotes. */
export async function loadPackagingCosts(): Promise<PackagingCosts> {
  const setup = await loadPriceListCostSetup();
  return packagingFromChoices({
    bottleBySize: setup.bottles,
    tools: setup.tools,
    selectedToolIds: setup.selectedToolIds,
  });
}

export async function loadPriceListCostSetup(): Promise<PriceListCostSetup> {
  const supabase = await createClient();
  const [rows, settingsResult] = await Promise.all([
    loadConsumableRows(),
    supabase
      .from("app_settings")
      .select("normal_bottle_mmk, price_list_tool_ids")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const missingColumn =
    settingsResult.error?.message.includes("normal_bottle_mmk") ||
    settingsResult.error?.message.includes("price_list_tool_ids");
  if (settingsResult.error && !missingColumn) {
    throw new Error(settingsResult.error.message);
  }

  const stock = packagingFromConsumables(rows);
  const saved = parseNormalBottles(
    missingColumn ? null : settingsResult.data?.normal_bottle_mmk,
  );
  const selected = new Set(
    missingColumn ? [] : (settingsResult.data?.price_list_tool_ids ?? []),
  );
  const tools = rows
    .filter((row) => row.isActive !== false && isToolCandidate(row.category))
    .filter((row) => row.unitCost > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      unitCost: row.unitCost,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    tools,
    selectedToolIds: tools
      .filter((tool) => selected.has(tool.id))
      .map((tool) => tool.id),
    bottlesConfigured: saved.configured,
    bottles: resolveNormalBottles({
      configured: saved.configured,
      saved: saved.bottles,
      stock: stock.bottleBySize,
    }),
    stockBottles: stock.bottleBySize,
  };
}

/** Cap-bottle extra, added on a sale only when the customer asks for it. */
export async function loadCapExtras(): Promise<CapExtras> {
  return capExtrasFromConsumables(await loadConsumableRows());
}

async function loadConsumableRows(): Promise<LoadedConsumable[]> {
  const supabase = await createClient();
  const [{ data: consumables }, { data: stock }] = await Promise.all([
    supabase
      .from("consumables")
      .select("id, name, category, cost_per_unit_mmk, is_active, updated_at"),
    supabase
      .from("inventory_items")
      .select("consumable_id, avg_unit_cost_mmk")
      .eq("item_type", "CONSUMABLE"),
  ]);

  const avgById = new Map<string, number>();
  for (const row of stock ?? []) {
    if (!row.consumable_id) continue;
    avgById.set(row.consumable_id, Number(row.avg_unit_cost_mmk));
  }

  return (consumables ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unitCost: liveUnitCost(
      Number(item.cost_per_unit_mmk),
      avgById.get(item.id),
    ),
    isActive: item.is_active,
    updatedAt: item.updated_at,
  }));
}
