import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";

const links = [
  {
    href: "/sales/orders",
    title: "Sales",
    description: "Create sales, track COGS and profit.",
  },
  {
    href: "/sales/price-list",
    title: "Price list",
    description: "Market sell prices by scent and size (auto-fills sales).",
  },
  {
    href: "/sales/customers",
    title: "Customers",
    description: "Optional customer records for credit sales.",
  },
  {
    href: "/sales/payments",
    title: "Payments",
    description: "Money collected (separate from sale totals).",
  },
] as const;

export default function SalesHubPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Sales"
        description="Sell from bottle liquid. Confirming the order pours the size."
        actionHref="/sales/orders/new"
        actionLabel="New sale"
      />
      <div className="grid gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-4 transition hover:border-[var(--accent)]"
          >
            <p className="font-medium text-[var(--ink)]">{link.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
