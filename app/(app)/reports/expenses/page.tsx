import { ExportLink } from "@/components/reports/export-link";
import { PeriodFilter } from "@/components/reports/period-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { resolvePeriod, type PeriodKey } from "@/lib/domain/pnl";
import { getExpenseReport } from "@/lib/domain/reports";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

export default async function ExpenseReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this_month";
  const range = resolvePeriod(period, params.from, params.to);
  const report = await getExpenseReport(range);
  const exportQs = new URLSearchParams({
    period,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }).toString();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Expense report"
        description={`${report.range.label} · by category`}
        backHref="/reports"
        backLabel="Reports"
      />

      <ExportLink href={`/api/export/expenses?${exportQs}`} />

      <PeriodFilter
        basePath="/reports/expenses"
        period={period}
        from={params.from ?? range.from}
        to={params.to ?? range.to}
      />

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--muted)]">Total expenses: </span>
        <span className="font-medium tabular-nums">
          {formatMmk(report.expenses)}
        </span>
      </div>

      {!report.expenseByCategory.length ? (
        <EmptyState
          title="No expenses in this period"
          description="Record operating costs under Expenses."
        />
      ) : (
        <div className="space-y-2">
          {report.expenseByCategory.map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm"
            >
              <span>
                {row.name}{" "}
                <span className="text-[var(--muted)]">
                  ({row.percent.toFixed(0)}%)
                </span>
              </span>
              <span className="tabular-nums">{formatMmk(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
