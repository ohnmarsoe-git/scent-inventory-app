import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import {
  getProfitLossSummary,
  type DateRange,
  type ProfitLossSummary,
} from "@/lib/domain/pnl";

export type SalesReportItem = {
  name: string;
  mlSold: number;
};

export type SalesReport = {
  range: DateRange;
  revenue: number;
  quantity: number;
  mlSold: number;
  cogs: number;
  grossProfit: number;
  saleCount: number;
  lines: Array<{
    sale_number: string;
    sale_date: string;
    customer: string;
    items: SalesReportItem[];
    quantity: number;
    mlSold: number;
    revenue: number;
    cogs: number;
    gross_profit: number;
  }>;
};

export async function getSalesReport(range: DateRange): Promise<SalesReport> {
  const supabase = await createClient();
  const { data: sales } = await supabase
    .from("sales")
    .select(
      "id, sale_number, sale_date, total_mmk, cogs_mmk, gross_profit_mmk, customers(name), sale_items(quantity, size_ml, description, perfume_id, perfumes(name, brands(name)))",
    )
    .eq("is_voided", false)
    .gte("sale_date", range.from)
    .lte("sale_date", range.to)
    .order("sale_date", { ascending: false });

  const lines = (sales ?? []).map((sale) => {
    const rawItems = Array.isArray(sale.sale_items) ? sale.sale_items : [];
    const items = rawItems.map(saleReportItem);
    const quantity = rawItems.reduce(
      (s: number, i: { quantity?: number | string }) =>
        s + Number(i.quantity ?? 0),
      0,
    );
    const mlSold = items.reduce((s, item) => s + item.mlSold, 0);
    return {
      sale_number: sale.sale_number as string,
      sale_date: sale.sale_date as string,
      customer:
        asOne(sale.customers as { name?: string } | null)?.name ?? "Walk-in",
      items,
      quantity,
      mlSold,
      revenue: Number(sale.total_mmk),
      cogs: Number(sale.cogs_mmk),
      gross_profit: Number(sale.gross_profit_mmk),
    };
  });

  return {
    range,
    revenue: lines.reduce((s, r) => s + r.revenue, 0),
    quantity: lines.reduce((s, r) => s + r.quantity, 0),
    mlSold: lines.reduce((s, r) => s + r.mlSold, 0),
    cogs: lines.reduce((s, r) => s + r.cogs, 0),
    grossProfit: lines.reduce((s, r) => s + r.gross_profit, 0),
    saleCount: lines.length,
    lines,
  };
}

function saleReportItem(item: {
  quantity?: number | string;
  size_ml?: number | string | null;
  description?: string | null;
  perfume_id?: string | null;
  perfumes?: unknown;
}): SalesReportItem {
  const quantity = Number(item.quantity ?? 0);
  const sizeMl = Number(item.size_ml ?? 0);
  const name = item.perfume_id
    ? perfumeLabel(item.perfumes)
    : itemNameFromDescription(item.description);
  return {
    name,
    mlSold: Math.round(sizeMl * quantity * 100) / 100,
  };
}

function itemNameFromDescription(description: string | null | undefined) {
  const text = (description ?? "").trim();
  const withoutSize = text.replace(/\s+\d+(?:\.\d+)?\s*ml$/i, "").trim();
  return withoutSize || text || "Item";
}

/** Treat "Name (Tester)" as the same product family as "Name" for bottle cost. */
function normalizePerfumeBaseName(name: string) {
  return name
    .replace(/\s*\(tester\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type ProductProfitRow = {
  perfume: string;
  perfumeId: string | null;
  quantity: number;
  mlSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  /** Full bottle size from perfume master (e.g. 100). */
  bottleSizeMl: number | null;
  /** Full-size bottle purchase cost (WAC × bottle ml, else latest PO unit cost). */
  bottlePurchaseCost: number | null;
};

export type ProductProfitReport = {
  range: DateRange;
  rows: ProductProfitRow[];
};

export async function getProductProfitReport(
  range: DateRange,
): Promise<ProductProfitReport> {
  const supabase = await createClient();
  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("is_voided", false)
    .gte("sale_date", range.from)
    .lte("sale_date", range.to);

  const saleIds = (sales ?? []).map((s) => s.id as string);
  if (saleIds.length === 0) {
    return { range, rows: [] };
  }

  const { data: items } = await supabase
    .from("sale_items")
    .select(
      "quantity, size_ml, line_total_mmk, cogs_mmk, profit_mmk, perfume_id, description, perfumes(name, brands(name))",
    )
    .in("sale_id", saleIds);

  const byPerfume = new Map<string, ProductProfitRow>();

  for (const item of items ?? []) {
    const perfumeId = (item.perfume_id as string | null) ?? null;
    const key = perfumeId ?? `desc:${item.description as string}`;
    const label = perfumeId
      ? perfumeLabel(item.perfumes)
      : (item.description as string);

    const existing = byPerfume.get(key) ?? {
      perfume: label,
      perfumeId,
      quantity: 0,
      mlSold: 0,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      bottleSizeMl: null,
      bottlePurchaseCost: null,
    };
    const quantity = Number(item.quantity);
    const sizeMl = Number(item.size_ml ?? 0);
    existing.quantity += quantity;
    existing.mlSold += sizeMl * quantity;
    existing.revenue += Number(item.line_total_mmk);
    existing.cogs += Number(item.cogs_mmk);
    existing.grossProfit += Number(item.profit_mmk);
    byPerfume.set(key, existing);
  }

  const perfumeIds = [
    ...new Set(
      [...byPerfume.values()]
        .map((row) => row.perfumeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (perfumeIds.length) {
    const { data: soldPerfumes } = await supabase
      .from("perfumes")
      .select("id, brand_id, name, default_bottle_size_ml")
      .in("id", perfumeIds);

    const brandIds = [
      ...new Set(
        (soldPerfumes ?? [])
          .map((p) => p.brand_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    // Include same-brand siblings (e.g. "X (Tester)" vs "X") for bottle cost.
    const { data: siblingPerfumes } = brandIds.length
      ? await supabase
          .from("perfumes")
          .select("id, brand_id, name, default_bottle_size_ml")
          .in("brand_id", brandIds)
      : { data: [] as Array<{
          id: string;
          brand_id: string;
          name: string;
          default_bottle_size_ml: number;
        }> };

    const allPerfumes = siblingPerfumes?.length
      ? siblingPerfumes
      : (soldPerfumes ?? []);
    const costPerfumeIds = [
      ...new Set(allPerfumes.map((p) => p.id as string)),
    ];

    const [{ data: liquid }, { data: poLines }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("perfume_id, avg_unit_cost_mmk")
        .eq("item_type", "PERFUME_LIQUID")
        .in("perfume_id", costPerfumeIds),
      supabase
        .from("purchase_order_items")
        .select(
          "perfume_id, bottle_size_ml, unit_cost_mmk, created_at, purchase_orders(order_date, created_at)",
        )
        .in("perfume_id", costPerfumeIds)
        .order("created_at", { ascending: false }),
    ]);

    const perfumeMeta = new Map(
      allPerfumes.map((p) => [
        p.id as string,
        {
          brandId: p.brand_id as string,
          name: String(p.name ?? ""),
          bottleSizeMl: Number(p.default_bottle_size_ml),
        },
      ]),
    );

    const idsByBrandBaseName = new Map<string, string[]>();
    for (const [id, meta] of perfumeMeta) {
      const key = `${meta.brandId}::${normalizePerfumeBaseName(meta.name)}`;
      const list = idsByBrandBaseName.get(key) ?? [];
      list.push(id);
      idsByBrandBaseName.set(key, list);
    }

    const avgPerMlByPerfume = new Map(
      (liquid ?? []).map((item) => [
        item.perfume_id as string,
        Number(item.avg_unit_cost_mmk),
      ]),
    );

    const latestPoCostByPerfume = new Map<
      string,
      { bottleSizeMl: number; unitCost: number }
    >();
    for (const line of poLines ?? []) {
      const perfumeId = line.perfume_id as string | null;
      if (!perfumeId || latestPoCostByPerfume.has(perfumeId)) continue;
      latestPoCostByPerfume.set(perfumeId, {
        bottleSizeMl: Number(line.bottle_size_ml),
        unitCost: Number(line.unit_cost_mmk),
      });
    }

    for (const row of byPerfume.values()) {
      if (!row.perfumeId) continue;
      const meta = perfumeMeta.get(row.perfumeId);
      if (!meta) continue;

      const relatedIds =
        idsByBrandBaseName.get(
          `${meta.brandId}::${normalizePerfumeBaseName(meta.name)}`,
        ) ?? [row.perfumeId];

      let bottleSize =
        Number.isFinite(meta.bottleSizeMl) && meta.bottleSizeMl > 0
          ? meta.bottleSizeMl
          : null;
      let avgPerMl: number | null = null;
      let latestPo: { bottleSizeMl: number; unitCost: number } | null = null;

      for (const id of relatedIds) {
        const siblingAvg = avgPerMlByPerfume.get(id);
        if (
          avgPerMl == null &&
          Number.isFinite(siblingAvg) &&
          (siblingAvg as number) > 0
        ) {
          avgPerMl = siblingAvg as number;
        }
        const siblingPo = latestPoCostByPerfume.get(id);
        if (!latestPo && siblingPo && Number.isFinite(siblingPo.unitCost)) {
          latestPo = siblingPo;
        }
        if (!bottleSize) {
          const siblingMeta = perfumeMeta.get(id);
          if (
            siblingMeta &&
            Number.isFinite(siblingMeta.bottleSizeMl) &&
            siblingMeta.bottleSizeMl > 0
          ) {
            bottleSize = siblingMeta.bottleSizeMl;
          }
        }
      }

      if (!bottleSize && latestPo?.bottleSizeMl) {
        bottleSize = latestPo.bottleSizeMl;
      }
      row.bottleSizeMl = bottleSize;

      if (bottleSize && avgPerMl != null && avgPerMl > 0) {
        row.bottlePurchaseCost =
          Math.round(avgPerMl * bottleSize * 100) / 100;
      } else if (latestPo && Number.isFinite(latestPo.unitCost)) {
        row.bottleSizeMl = latestPo.bottleSizeMl || row.bottleSizeMl;
        row.bottlePurchaseCost = Math.round(latestPo.unitCost * 100) / 100;
      }
    }
  }

  const rows = [...byPerfume.values()].sort(
    (a, b) => b.grossProfit - a.grossProfit,
  );

  return { range, rows };
}

export type ExpenseReport = ProfitLossSummary;

export async function getExpenseReport(
  range: DateRange,
): Promise<ExpenseReport> {
  return getProfitLossSummary(range);
}

export type InventoryReportRow = {
  product: string;
  item_type: string;
  quantity: number;
  unit: string;
  size_ml: number | null;
  unit_cost: number;
  value: number;
};

export type InventoryReport = {
  rows: InventoryReportRow[];
  totalValue: number;
};

export async function getInventoryReport(): Promise<InventoryReport> {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("inventory_items")
    .select(
      "item_type, quantity_on_hand, avg_unit_cost_mmk, unit, size_ml, perfumes(name, brands(name)), consumables(name)",
    )
    .gt("quantity_on_hand", 0)
    .order("item_type");

  const rows: InventoryReportRow[] = (items ?? []).map((item) => {
    const qty = Number(item.quantity_on_hand);
    const unitCost = Number(item.avg_unit_cost_mmk);
    let product = "Item";
    if (item.item_type === "CONSUMABLE") {
      product =
        asOne(item.consumables as { name?: string } | null)?.name ??
        "Consumable";
    } else {
      product = perfumeLabel(item.perfumes);
      if (item.item_type === "DECANT" && item.size_ml) {
        product = `${product} (${item.size_ml}ml)`;
      } else if (item.item_type === "PERFUME_LIQUID") {
        product = `${product} (liquid)`;
      }
    }
    return {
      product,
      item_type: item.item_type as string,
      quantity: qty,
      unit: item.unit as string,
      size_ml: item.size_ml != null ? Number(item.size_ml) : null,
      unit_cost: unitCost,
      value: qty * unitCost,
    };
  });

  return {
    rows,
    totalValue: rows.reduce((s, r) => s + r.value, 0),
  };
}

export type PurchaseReportRow = {
  po_number: string;
  order_date: string;
  supplier: string;
  status: string;
  purchase_amount: number;
  received_amount: number;
  outstanding: boolean;
};

export type PurchaseReport = {
  range: DateRange;
  rows: PurchaseReportRow[];
  totalPurchase: number;
  totalReceived: number;
  outstandingCount: number;
};

export async function getPurchaseReport(
  range: DateRange,
): Promise<PurchaseReport> {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("purchase_orders")
    .select(
      "po_number, order_date, status, total_mmk, suppliers(name), purchase_order_items(quantity, received_quantity, line_total_mmk)",
    )
    .neq("status", "cancelled")
    .gte("order_date", range.from)
    .lte("order_date", range.to)
    .order("order_date", { ascending: false });

  const rows: PurchaseReportRow[] = (orders ?? []).map((po) => {
    const items = Array.isArray(po.purchase_order_items)
      ? po.purchase_order_items
      : [];
    const purchaseAmount = Number(po.total_mmk);
    let receivedAmount = 0;
    for (const item of items as Array<{
      quantity?: number | string;
      received_quantity?: number | string;
      line_total_mmk?: number | string;
    }>) {
      const qty = Number(item.quantity ?? 0);
      const recv = Number(item.received_quantity ?? 0);
      const line = Number(item.line_total_mmk ?? 0);
      if (qty > 0) receivedAmount += line * (recv / qty);
    }
    const outstanding =
      po.status === "ordered" || po.status === "partially_received";

    return {
      po_number: po.po_number as string,
      order_date: po.order_date as string,
      supplier:
        asOne(po.suppliers as { name?: string } | null)?.name ?? "—",
      status: po.status as string,
      purchase_amount: purchaseAmount,
      received_amount: Math.round(receivedAmount * 100) / 100,
      outstanding,
    };
  });

  return {
    range,
    rows,
    totalPurchase: rows.reduce((s, r) => s + r.purchase_amount, 0),
    totalReceived: rows.reduce((s, r) => s + r.received_amount, 0),
    outstandingCount: rows.filter((r) => r.outstanding).length,
  };
}
