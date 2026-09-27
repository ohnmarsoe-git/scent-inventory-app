import { ExportLink } from "@/components/reports/export-link";
import { PeriodFilter } from "@/components/reports/period-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { resolvePeriod, type PeriodKey } from "@/lib/domain/pnl";
import { getPurchaseReport } from "@/lib/domain/reports";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

export default async function PurchaseReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period as PeriodKey) || "this_month";
  const range = resolvePeriod(period, params.from, params.to);
  const report = await getPurchaseReport(range);
  const exportQs = new URLSearchParams({
    period,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }).toString();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Purchase report"
        description={`${report.range.label} · ${report.outstandingCount} open`}
        backHref="/reports"
        backLabel="Reports"
      />

      <ExportLink href={`/api/export/purchases?${exportQs}`} />

      <PeriodFilter
        basePath="/reports/purchases"
        period={period}
        from={params.from ?? range.from}
        to={params.to ?? range.to}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Purchase amount" value={formatMmk(report.totalPurchase)} />
        <Stat label="Received (est.)" value={formatMmk(report.totalReceived)} />
        <Stat
          label="Outstanding POs"
          value={String(report.outstandingCount)}
        />
      </div>

      {!report.rows.length ? (
        <EmptyState
          title="No purchases in this period"
          description="Create a purchase order to see it here."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">PO</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Purchase</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.po_number}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">{row.po_number}</span>
                      <span className="ml-2 text-[var(--muted)]">
                        {row.order_date}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.supplier}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.status}
                      {row.outstanding ? " · open" : ""}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMmk(row.purchase_amount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {formatMmk(row.received_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {report.rows.map((row) => (
              <div
                key={row.po_number}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <p className="font-medium">
                  {row.po_number} · {row.supplier}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  {row.order_date} · {row.status}
                </p>
                <p className="mt-2 tabular-nums">
                  {formatMmk(row.purchase_amount)} · recv{" "}
                  {formatMmk(row.received_amount)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
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
