import {
  capExtrasFromConsumables,
  isToolCandidate,
  liveUnitCost,
  packagingFromChoices,
  packagingFromConsumables,
  parseNormalBottles,
  parseToolSizes,
  resolveNormalBottles,
  type CapExtras,
  type ConsumableCostRow,
  type BottleCostSize,
  type PackagingCosts,
  type ToolChoice,
} from "@/lib/domain/pricing";
import { createClient } from "@/lib/supabase/server";

export type PriceListCostSetup = {
  tools: ToolChoice[];
  selectedToolIds: string[];
  /** Sizes that receive ticked tools (2ml usually off for discovery sets). */
  toolSizes: BottleCostSize[];
  /** True after the user has saved normal bottle prices. */
  bottlesConfigured: boolean;
  /** Bottle prices used in the margin right now. */
  bottles: Partial<Record<BottleCostSize, number>>;
  /** Stock bottle cost for that ml, shown so it can be replaced. */
  stockBottles: Partial<Record<BottleCostSize, number>>;
};

type LoadedConsumable = ConsumableCostRow & { id: string };

/** Bottle and tools cost used for price-list margin and sale quotes. */
export async function loadPackagingCosts(): Promise<PackagingCosts> {
  const setup = await loadPriceListCostSetup();
  return packagingFromChoices({
    bottleBySize: setup.bottles,
    tools: setup.tools,
    selectedToolIds: setup.selectedToolIds,
    toolSizes: setup.toolSizes,
  });
}

export async function loadPriceListCostSetup(): Promise<PriceListCostSetup> {
  const supabase = await createClient();
  const [rows, settingsResult] = await Promise.all([
    loadConsumableRows(),
    supabase
      .from("app_settings")
      .select("normal_bottle_mmk, price_list_tool_ids, price_list_tool_sizes")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const missingColumn =
    settingsResult.error?.message.includes("normal_bottle_mmk") ||
    settingsResult.error?.message.includes("price_list_tool_ids");
  const missingToolSizes = settingsResult.error?.message.includes(
    "price_list_tool_sizes",
  );
  if (settingsResult.error && !missingColumn && !missingToolSizes) {
    throw new Error(settingsResult.error.message);
  }

  let settings = settingsResult.data;
  if (missingToolSizes) {
    const fallback = await supabase
      .from("app_settings")
      .select("normal_bottle_mmk, price_list_tool_ids")
      .eq("id", 1)
      .maybeSingle();
    if (fallback.error && !missingColumn) {
      throw new Error(fallback.error.message);
    }
    settings = fallback.data
      ? { ...fallback.data, price_list_tool_sizes: null }
      : null;
  }

  const stock = packagingFromConsumables(rows);
  const saved = parseNormalBottles(
    missingColumn ? null : settings?.normal_bottle_mmk,
  );
  const selected = new Set(
    missingColumn ? [] : (settings?.price_list_tool_ids ?? []),
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
    toolSizes: parseToolSizes(
      missingColumn ? null : settings?.price_list_tool_sizes,
    ),
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
