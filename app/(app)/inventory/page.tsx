import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";

const links = [
  {
    href: "/inventory/stock",
    title: "Stock on hand",
    description: "Current liquid, decant, and consumable balances.",
  },
  {
    href: "/inventory/decants",
    title: "Decants",
    description: "History of pours. New orders pour automatically — do not decant first.",
  },
  {
    href: "/inventory/testers",
    title: "Testers",
    description: "2ml and 3ml pours that are not sold. Removes those millilitres from stock.",
  },
  {
    href: "/inventory/movements",
    title: "Stock movements",
    description: "History of every inventory change.",
  },
  {
    href: "/inventory/brands",
    title: "Brands",
    description: "Manage perfume brands.",
  },
  {
    href: "/inventory/perfumes",
    title: "Perfumes",
    description: "Fragrance catalog (cost from purchases).",
  },
  {
    href: "/inventory/consumables",
    title: "Consumables",
    description: "Bottles, labels, packaging materials.",
  },
] as const;

export default function InventoryHubPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Masters, stock balances, decants, and movement history."
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
