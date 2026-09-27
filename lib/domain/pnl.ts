import { asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import {
  resolvePeriod,
  type DateRange,
  type PeriodKey,
} from "@/lib/domain/period";

export type { DateRange, PeriodKey };
export { resolvePeriod };

export type ProfitLossSummary = {
  range: DateRange;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  collected: number;
  outstanding: number;
  expenseByCategory: Array<{ name: string; amount: number; percent: number }>;
  samples: number;
};

export async function getProfitLossSummary(
  range: DateRange,
): Promise<ProfitLossSummary> {
  const supabase = await createClient();

  const [
    { data: sales },
    { data: payments },
    { data: expenses },
    { data: openSales },
    { data: samples },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("total_mmk, cogs_mmk")
      .eq("is_voided", false)
      .gte("sale_date", range.from)
      .lte("sale_date", range.to),
    supabase
      .from("payments")
      .select("amount_mmk")
      .gte("payment_date", range.from)
      .lte("payment_date", range.to),
    supabase
      .from("expenses")
      .select("amount_mmk, expense_categories(name)")
      .gte("expense_date", range.from)
      .lte("expense_date", range.to),
    supabase
      .from("sales")
      .select("remaining_amount_mmk")
      .eq("is_voided", false)
      .gt("remaining_amount_mmk", 0),
    supabase
      .from("inventory_movements")
      .select("total_cost_mmk")
      .eq("movement_type", "SAMPLE")
      .gte("moved_at", range.from)
      .lte("moved_at", `${range.to}T23:59:59.999Z`),
  ]);

  const revenue = (sales ?? []).reduce((s, r) => s + Number(r.total_mmk), 0);
  const cogs = (sales ?? []).reduce((s, r) => s + Number(r.cogs_mmk), 0);
  const grossProfit = revenue - cogs;
  const expenseTotal = (expenses ?? []).reduce(
    (s, r) => s + Number(r.amount_mmk),
    0,
  );
  const collected = (payments ?? []).reduce(
    (s, r) => s + Number(r.amount_mmk),
    0,
  );
  const outstanding = (openSales ?? []).reduce(
    (s, r) => s + Number(r.remaining_amount_mmk),
    0,
  );
  const sampleCost = (samples ?? []).reduce(
    (s, r) => s + Math.abs(Number(r.total_cost_mmk)),
    0,
  );

  const byCat = new Map<string, number>();
  for (const row of expenses ?? []) {
    const cat =
      asOne(
        row.expense_categories as { name?: string } | { name?: string }[] | null,
      )?.name ?? "Other";
    byCat.set(cat, (byCat.get(cat) ?? 0) + Number(row.amount_mmk));
  }

  const expenseByCategory = [...byCat.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      percent: expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    range,
    revenue,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    samples: sampleCost,
    netProfit: grossProfit - expenseTotal - sampleCost,
    collected,
    outstanding,
    expenseByCategory,
  };
}

export type DashboardMetrics = {
  month: ProfitLossSummary;
  inventoryValue: number;
  perfumeCount: number;
  lowStockCount: number;
  pendingPurchases: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();
  const monthRange = resolvePeriod("this_month");
  const month = await getProfitLossSummary(monthRange);

  const [
    { data: stock },
    { count: perfumeCount },
    { data: lowLiquid },
    { count: pendingPurchases },
  ] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("quantity_on_hand, avg_unit_cost_mmk")
      .gt("quantity_on_hand", 0),
    supabase
      .from("perfumes")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("inventory_items")
      .select("id")
      .eq("item_type", "PERFUME_LIQUID")
      .gt("quantity_on_hand", 0)
      .lt("quantity_on_hand", 10),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["ordered", "partially_received"]),
  ]);

  const inventoryValue = (stock ?? []).reduce(
    (s, r) => s + Number(r.quantity_on_hand) * Number(r.avg_unit_cost_mmk),
    0,
  );

  return {
    month,
    inventoryValue,
    perfumeCount: perfumeCount ?? 0,
    lowStockCount: lowLiquid?.length ?? 0,
    pendingPurchases: pendingPurchases ?? 0,
  };
}
