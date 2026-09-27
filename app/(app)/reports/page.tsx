import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { btnPrimaryClass, btnSecondaryClass } from "@/lib/ui";

const reports = [
  {
    href: "/reports/sales",
    title: "Sales",
    description: "Item, millilitres sold, revenue, COGS, and profit by period.",
  },
  {
    href: "/reports/products",
    title: "Product profit",
    description: "Per-perfume ml sold, revenue, COGS, and profit.",
  },
  {
    href: "/reports/expenses",
    title: "Expenses",
    description: "Operating costs by category with percentages.",
  },
  {
    href: "/reports/inventory",
    title: "Inventory",
    description: "On-hand quantity, unit cost, and inventory value.",
  },
  {
    href: "/reports/purchases",
    title: "Purchases",
    description: "Purchase amounts, received value, and open orders.",
  },
] as const;

export default function ReportsHubPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Reports"
        description="Sales, product profit, expenses, inventory, and purchases."
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/reports/import" className={btnPrimaryClass}>
          Import CSV
        </Link>
        <Link href="/expenses/pnl" className={btnSecondaryClass}>
          Profit &amp; Loss
        </Link>
      </div>

      <div className="space-y-3">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="block border border-[var(--stroke)] bg-[var(--surface)] p-4 transition hover:border-[var(--ink)]"
          >
            <p className="font-medium text-[var(--ink)]">{report.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {report.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
