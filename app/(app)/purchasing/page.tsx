import Link from "next/link";

import { PreorderMoney } from "@/components/purchasing/preorder-money";
import { PageHeader } from "@/components/ui/page-header";

const links = [
  {
    href: "/purchasing/orders",
    title: "Purchase orders",
    description: "Place a pre-order, record the deposit, see what is left to pay.",
  },
  {
    href: "/purchasing/receiving",
    title: "Receiving",
    description: "Receive stock into perfume liquid inventory.",
  },
  {
    href: "/purchasing/suppliers",
    title: "Suppliers",
    description: "Who you buy perfume and packaging from.",
  },
] as const;

export default function PurchasingHubPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Purchasing"
        description="Buy stock from suppliers. Money paid before the bottle arrives is invested in that stock."
      />
      <PreorderMoney />
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
