import { MetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getDashboardMetrics } from "@/lib/domain/pnl";

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();
  const { month } = metrics;

  const monthMetrics = [
    { label: "Total Sales", value: month.revenue },
    { label: "Amount Collected", value: month.collected },
    { label: "Outstanding", value: month.outstanding },
    { label: "COGS", value: month.cogs },
    { label: "Gross Profit", value: month.grossProfit },
    { label: "Expenses", value: month.expenses },
    { label: "Testers", value: month.samples },
    {
      label: "Net Profit",
      value: month.netProfit,
      emphasize: true,
    },
  ];

  const inventoryMetrics = [
    { label: "Inventory Value", value: metrics.inventoryValue, currency: true },
    { label: "Perfumes", value: metrics.perfumeCount, currency: false },
    { label: "Low Stock", value: metrics.lowStockCount, currency: false },
    {
      label: "Open Purchases",
      value: metrics.pendingPurchases,
      currency: false,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <section>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)] lg:text-4xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {month.range.label} · live sales, payments, and expenses
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          This month
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {monthMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          Inventory
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {inventoryMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              currency={metric.currency}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          Quick actions
        </h2>
        <QuickActions />
      </section>
    </div>
  );
}
