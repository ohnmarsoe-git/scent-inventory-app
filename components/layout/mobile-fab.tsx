"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FAB_ROUTES: Array<{ match: (p: string) => boolean; href: string; label: string }> = [
  {
    match: (p) => p.startsWith("/expenses"),
    href: "/expenses/new",
    label: "New expense",
  },
  {
    match: (p) => p.startsWith("/purchasing"),
    href: "/purchasing/orders/new",
    label: "New purchase",
  },
];

export function MobileFab() {
  const pathname = usePathname();

  if (
    pathname.endsWith("/new") ||
    pathname.endsWith("/edit") ||
    pathname.endsWith("/receive") ||
    pathname.startsWith("/reports/import")
  ) {
    return null;
  }

  const action = FAB_ROUTES.find((r) => r.match(pathname));
  if (!action) return null;

  return (
    <Link
      href={action.href}
      className="btn-primary fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 min-w-14 px-4 shadow-[0_8px_24px_rgba(20,22,26,0.18)] lg:hidden"
      aria-label={action.label}
    >
      {action.label}
    </Link>
  );
}
