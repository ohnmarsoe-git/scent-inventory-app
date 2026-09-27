import { ExportLink } from "@/components/reports/export-link";
import { PeriodFilter } from "@/components/reports/period-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { resolvePeriod, type PeriodKey } from "@/lib/domain/pnl";
import { getSalesReport } from "@/lib/domain/reports";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

export default async function SalesReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this_month";
  const range = resolvePeriod(period, params.from, params.to);
  const report = await getSalesReport(range);
  const exportQs = new URLSearchParams({
    period,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }).toString();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Sales report"
        description={`${report.range.label} · ${report.saleCount} sales · ${formatMl(report.mlSold)} sold`}
        backHref="/reports"
        backLabel="Reports"
      />

      <div className="flex flex-wrap gap-3">
        <ExportLink href={`/api/export/sales?${exportQs}`} />
      </div>

      <PeriodFilter
        basePath="/reports/sales"
        period={period}
        from={params.from ?? range.from}
        to={params.to ?? range.to}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Revenue" value={formatMmk(report.revenue)} />
        <Stat label="Quantity" value={report.quantity.toLocaleString()} />
        <Stat label="ml sold" value={formatMl(report.mlSold)} />
        <Stat label="COGS" value={formatMmk(report.cogs)} />
        <Stat label="Gross profit" value={formatMmk(report.grossProfit)} />
      </div>

      {!report.lines.length ? (
        <EmptyState
          title="No sales in this period"
          description="Try another date range."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Sale</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">ml sold</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">COGS</th>
                  <th className="px-4 py-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((row) => (
                  <tr
                    key={row.sale_number}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.sale_number}</span>
                      <span className="ml-2 text-[var(--muted)]">
                        {row.sale_date}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.customer}
                    </td>
                    <td className="px-4 py-3">
                      <ItemList items={row.items} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <MlList items={row.items} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.quantity}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMmk(row.revenue)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {formatMmk(row.cogs)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMmk(row.gross_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {report.lines.map((row) => (
              <div
                key={row.sale_number}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <p className="font-medium">
                  {row.sale_number} · {row.sale_date}
                </p>
                <p className="mt-1 text-[var(--muted)]">{row.customer}</p>
                <ul className="mt-2 space-y-1">
                  {row.items.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      {item.name}
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {formatMl(item.mlSold)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 tabular-nums">
                  {formatMmk(row.revenue)} · Profit {formatMmk(row.gross_profit)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatMl(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })} ml`;
}

function ItemList({
  items,
}: {
  items: Array<{ name: string; mlSold: number }>;
}) {
  if (!items.length) return <span className="text-[var(--muted)]">—</span>;
  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <p key={`${item.name}-${index}`} className="whitespace-nowrap">
          {item.name}
        </p>
      ))}
    </div>
  );
}

function MlList({
  items,
}: {
  items: Array<{ name: string; mlSold: number }>;
}) {
  if (!items.length) return <span className="text-[var(--muted)]">—</span>;
  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <p key={`${item.name}-${index}`}>{formatMl(item.mlSold)}</p>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--stroke)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl tabular-nums">
        {value}
      </p>
    </div>
  );
}
