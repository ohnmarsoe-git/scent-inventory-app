import { Suspense } from "react";

import { ExportLink } from "@/components/reports/export-link";
import { PeriodFilter } from "@/components/reports/period-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { resolvePeriod, type PeriodKey } from "@/lib/domain/pnl";
import { getProductProfitReport } from "@/lib/domain/reports";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
};

export default async function ProductProfitReportPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this_month";
  const q = params.q?.trim() ?? "";
  const range = resolvePeriod(period, params.from, params.to);
  const report = await getProductProfitReport(range);
  const needle = q.toLowerCase();
  const rows = q
    ? report.rows.filter((row) => row.perfume.toLowerCase().includes(needle))
    : report.rows;
  const mlSold = rows.reduce((sum, row) => sum + row.mlSold, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const cogs = rows.reduce((sum, row) => sum + row.cogs, 0);
  const grossProfit = rows.reduce((sum, row) => sum + row.grossProfit, 0);
  const exportQs = new URLSearchParams({
    period,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(q ? { q } : {}),
  }).toString();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Product profit"
        description={
          q
            ? `${report.range.label} · filtered by “${q}” · ${formatMl(mlSold)} sold`
            : `${report.range.label} · ${formatMl(mlSold)} sold · full bottle cost is stock WAC × bottle size`
        }
        backHref="/reports"
        backLabel="Reports"
      />

      <ExportLink href={`/api/export/products?${exportQs}`} />

      <Suspense fallback={null}>
        <SearchFilter
          placeholder="Search item / perfume name…"
          showArchivedToggle={false}
        />
      </Suspense>

      <PeriodFilter
        basePath="/reports/products"
        period={period}
        from={params.from ?? range.from}
        to={params.to ?? range.to}
        keepParams={{ q: q || undefined }}
      />

      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="ml sold" value={formatMl(mlSold)} />
          <Stat label="Revenue" value={formatMmk(revenue)} />
          <Stat label="COGS" value={formatMmk(cogs)} />
          <Stat label="Gross profit" value={formatMmk(grossProfit)} />
        </div>
      ) : null}

      {!rows.length ? (
        <EmptyState
          title={q ? "No matching products" : "No product sales in this period"}
          description={
            q
              ? "Try another name, or switch to All time."
              : "Sell a decant or liquid to see profit by perfume."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Perfume</th>
                  <th className="px-4 py-3 font-medium">Full bottle</th>
                  <th className="px-4 py-3 font-medium">Bottle cost</th>
                  <th className="px-4 py-3 font-medium">Qty sold</th>
                  <th className="px-4 py-3 font-medium">ml sold</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">COGS</th>
                  <th className="px-4 py-3 font-medium">Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.perfume}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{row.perfume}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {row.bottleSizeMl ? `${row.bottleSizeMl} ml` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {row.bottlePurchaseCost != null
                        ? formatMmk(row.bottlePurchaseCost)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.quantity}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMl(row.mlSold)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMmk(row.revenue)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {formatMmk(row.cogs)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-[var(--success)]">
                      {formatMmk(row.grossProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div
                key={row.perfume}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <p className="font-medium">{row.perfume}</p>
                <p className="mt-1 tabular-nums text-[var(--muted)]">
                  Full bottle{" "}
                  {row.bottleSizeMl ? `${row.bottleSizeMl} ml` : "—"}
                  {row.bottlePurchaseCost != null
                    ? ` · ${formatMmk(row.bottlePurchaseCost)}`
                    : ""}
                </p>
                <p className="mt-2 tabular-nums text-[var(--muted)]">
                  Qty {row.quantity} · {formatMl(row.mlSold)} ·{" "}
                  {formatMmk(row.revenue)} · COGS {formatMmk(row.cogs)}
                </p>
                <p className="mt-1 tabular-nums font-medium text-[var(--success)]">
                  Profit {formatMmk(row.grossProfit)}
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
