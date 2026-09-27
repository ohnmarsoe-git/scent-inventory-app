import { NextResponse } from "next/server";

import { toCsv } from "@/lib/csv";
import { resolvePeriod, type PeriodKey } from "@/lib/domain/pnl";
import {
  getExpenseReport,
  getInventoryReport,
  getProductProfitReport,
  getPurchaseReport,
  getSalesReport,
} from "@/lib/domain/reports";
import { getProfitLossSummary } from "@/lib/domain/pnl";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ report: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { report } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = (url.searchParams.get("period") as PeriodKey) || "this_month";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const range = resolvePeriod(period, from, to);

  let csv = "";
  let filename = `${report}.csv`;

  switch (report) {
    case "sales": {
      const data = await getSalesReport(range);
      const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
      const saleLines = q
        ? data.lines.filter(
            (r) =>
              r.items.some((item) => item.name.toLowerCase().includes(q)) ||
              r.sale_number.toLowerCase().includes(q) ||
              r.customer.toLowerCase().includes(q),
          )
        : data.lines;
      csv = toCsv(
        [
          "sale_number",
          "sale_date",
          "customer",
          "item",
          "ml_sold",
          "quantity",
          "revenue",
          "cogs",
          "gross_profit",
        ],
        saleLines.map((r) => [
          r.sale_number,
          r.sale_date,
          r.customer,
          r.items
            .map((item) => `${item.name} (${item.mlSold} ml)`)
            .join("; "),
          r.mlSold,
          r.quantity,
          r.revenue,
          r.cogs,
          r.gross_profit,
        ]),
      );
      filename = `sales-${range.from}-${range.to}.csv`;
      break;
    }
    case "products": {
      const data = await getProductProfitReport(range);
      const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
      const productRows = q
        ? data.rows.filter((r) => r.perfume.toLowerCase().includes(q))
        : data.rows;
      csv = toCsv(
        [
          "perfume",
          "full_bottle_ml",
          "bottle_purchase_cost",
          "quantity",
          "ml_sold",
          "revenue",
          "cogs",
          "gross_profit",
        ],
        productRows.map((r) => [
          r.perfume,
          r.bottleSizeMl ?? "",
          r.bottlePurchaseCost ?? "",
          r.quantity,
          Math.round(r.mlSold * 100) / 100,
          r.revenue,
          r.cogs,
          r.grossProfit,
        ]),
      );
      filename = `product-profit-${range.from}-${range.to}.csv`;
      break;
    }
    case "expenses": {
      const data = await getExpenseReport(range);
      csv = toCsv(
        ["category", "amount", "percent"],
        data.expenseByCategory.map((r) => [
          r.name,
          r.amount,
          Number(r.percent.toFixed(2)),
        ]),
      );
      filename = `expenses-${range.from}-${range.to}.csv`;
      break;
    }
    case "inventory": {
      const data = await getInventoryReport();
      csv = toCsv(
        ["product", "item_type", "quantity", "unit", "unit_cost", "value"],
        data.rows.map((r) => [
          r.product,
          r.item_type,
          r.quantity,
          r.unit,
          r.unit_cost,
          r.value,
        ]),
      );
      filename = `inventory.csv`;
      break;
    }
    case "purchases": {
      const data = await getPurchaseReport(range);
      csv = toCsv(
        [
          "po_number",
          "order_date",
          "supplier",
          "status",
          "purchase_amount",
          "received_amount",
          "outstanding",
        ],
        data.rows.map((r) => [
          r.po_number,
          r.order_date,
          r.supplier,
          r.status,
          r.purchase_amount,
          r.received_amount,
          r.outstanding ? "yes" : "no",
        ]),
      );
      filename = `purchases-${range.from}-${range.to}.csv`;
      break;
    }
    case "pnl": {
      const data = await getProfitLossSummary(range);
      csv = toCsv(
        ["metric", "amount"],
        [
          ["revenue", data.revenue],
          ["cogs", data.cogs],
          ["gross_profit", data.grossProfit],
          ["expenses", data.expenses],
          ["testers", data.samples],
          ["net_profit", data.netProfit],
          ["collected", data.collected],
          ["outstanding", data.outstanding],
        ],
      );
      filename = `pnl-${range.from}-${range.to}.csv`;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
