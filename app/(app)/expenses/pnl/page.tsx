import { ExportLink } from "@/components/reports/export-link";
import { PeriodFilter } from "@/components/reports/period-filter";
import { PageHeader } from "@/components/ui/page-header";
import {
  getProfitLossSummary,
  resolvePeriod,
  type PeriodKey,
} from "@/lib/domain/pnl";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function ProfitLossPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this_month";
  const range = resolvePeriod(period, params.from, params.to);
  const summary = await getProfitLossSummary(range);
  const exportQs = new URLSearchParams({
    period,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }).toString();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Profit & Loss"
        description={`${summary.range.label} · Revenue − COGS − testers − operating expenses`}
        backHref="/expenses"
        backLabel="Expenses"
      />

      <ExportLink href={`/api/export/pnl?${exportQs}`} />

      <PeriodFilter
        basePath="/expenses/pnl"
        period={period}
        from={params.from ?? summary.range.from}
        to={params.to ?? summary.range.to}
      />

      <section className="space-y-0 border border-[var(--stroke)] bg-[var(--surface)] text-sm">
        <PnlRow label="Revenue (sales)" value={summary.revenue} />
        <PnlRow label="− COGS" value={summary.cogs} />
        <PnlRow label="Gross profit" value={summary.grossProfit} emphasize />
        <PnlRow label="− Operating expenses" value={summary.expenses} />
        <PnlRow label="− Testers" value={summary.samples} />
        <PnlRow label="Net profit" value={summary.netProfit} emphasize last />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Collected (payments)
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tabular-nums">
            {formatMmk(summary.collected)}
          </p>
        </div>
        <div className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Outstanding (all open)
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tabular-nums">
            {formatMmk(summary.outstanding)}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Expenses by category
        </h2>
        {!summary.expenseByCategory.length ? (
          <p className="text-sm text-[var(--muted)]">No expenses in this period.</p>
        ) : (
          <div className="space-y-2">
            {summary.expenseByCategory.map((row) => (
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
      </section>
    </div>
  );
}

function PnlRow({
  label,
  value,
  emphasize,
  last,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${
        last ? "" : "border-b border-[var(--stroke)]"
      } ${emphasize ? "bg-[var(--surface-2)]" : ""}`}
    >
      <span className={emphasize ? "font-medium" : "text-[var(--muted)]"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasize ? "font-medium text-[var(--ink)]" : ""}`}
      >
        {formatMmk(value)}
      </span>
    </div>
  );
}
