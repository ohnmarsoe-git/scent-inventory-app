import { ExportLink } from "@/components/reports/export-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getInventoryReport } from "@/lib/domain/reports";
import { formatMmk } from "@/lib/ui";

export default async function InventoryReportPage() {
  const report = await getInventoryReport();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Inventory report"
        description="Current on-hand quantity, unit cost, and value."
        backHref="/reports"
        backLabel="Reports"
      />

      <ExportLink href="/api/export/inventory" />

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--muted)]">Total inventory value: </span>
        <span className="font-medium tabular-nums">
          {formatMmk(report.totalValue)}
        </span>
      </div>

      {!report.rows.length ? (
        <EmptyState
          title="No stock on hand"
          description="Receive purchases or import opening liquid stock."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Unit cost</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={`${row.product}-${row.item_type}-${row.size_ml}`}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{row.product}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {row.item_type}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                      {formatMmk(row.unit_cost)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatMmk(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {report.rows.map((row) => (
              <div
                key={`${row.product}-${row.item_type}-${row.size_ml}`}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <p className="font-medium">{row.product}</p>
                <p className="mt-1 text-[var(--muted)]">{row.item_type}</p>
                <p className="mt-2 tabular-nums">
                  {row.quantity} {row.unit} · {formatMmk(row.value)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
