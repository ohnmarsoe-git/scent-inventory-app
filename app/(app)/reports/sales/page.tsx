import { Suspense } from "react";

import { ExportLink } from "@/components/reports/export-link";
import { PeriodFilter } from "@/components/reports/period-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { resolvePeriod, type PeriodKey } from "@/lib/domain/pnl";
import { getSalesReport } from "@/lib/domain/reports";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
};

export default async function SalesReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this_month";
  const q = params.q?.trim() ?? "";
  const range = resolvePeriod(period, params.from, params.to);
  const report = await getSalesReport(range);
  const needle = q.toLowerCase();
  const lines = q
    ? report.lines.filter(
        (row) =>
          row.items.some((item) => item.name.toLowerCase().includes(needle)) ||
          row.sale_number.toLowerCase().includes(needle) ||
          row.customer.toLowerCase().includes(needle),
      )
    : report.lines;
  const revenue = lines.reduce((sum, row) => sum + row.revenue, 0);
  const quantity = lines.reduce((sum, row) => sum + row.quantity, 0);
  const mlSold = lines.reduce((sum, row) => sum + row.mlSold, 0);
  const cogs = lines.reduce((sum, row) => sum + row.cogs, 0);
  const grossProfit = lines.reduce((sum, row) => sum + row.gross_profit, 0);
  const exportQs = new URLSearchParams({
    period,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(q ? { q } : {}),
  }).toString();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Sales report"
        description={
          q
            ? `${report.range.label} · filtered by “${q}” · ${lines.length} sales · ${formatMl(mlSold)} sold`
            : `${report.range.label} · ${lines.length} sales · ${formatMl(mlSold)} sold`
        }
        backHref="/reports"
        backLabel="Reports"
      />

      <div className="flex flex-wrap gap-3">
        <ExportLink href={`/api/export/sales?${exportQs}`} />
      </div>

      <Suspense fallback={null}>
        <SearchFilter
          placeholder="Search item, sale number, or customer…"
          showArchivedToggle={false}
        />
      </Suspense>

      <PeriodFilter
        basePath="/reports/sales"
        period={period}
        from={params.from ?? range.from}
        to={params.to ?? range.to}
        keepParams={{ q: q || undefined }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Revenue" value={formatMmk(revenue)} />
        <Stat label="Quantity" value={quantity.toLocaleString()} />
        <Stat label="ml sold" value={formatMl(mlSold)} />
        <Stat label="COGS" value={formatMmk(cogs)} />
        <Stat label="Gross profit" value={formatMmk(grossProfit)} />
      </div>

      {!lines.length ? (
        <EmptyState
          title={q ? "No matching sales" : "No sales in this period"}
          description={
            q
              ? "Try another item name, or switch the date range."
              : "Try another date range."
          }
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
                {lines.map((row) => (
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
            {lines.map((row) => (
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
