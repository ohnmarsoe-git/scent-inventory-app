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

export type ProductProfitRow = {
  perfume: string;
  quantity: number;
  mlSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
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
    const key =
      (item.perfume_id as string | null) ??
      `desc:${item.description as string}`;
    const label = item.perfume_id
      ? perfumeLabel(item.perfumes)
      : (item.description as string);

    const existing = byPerfume.get(key) ?? {
      perfume: label,
      quantity: 0,
      mlSold: 0,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
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
