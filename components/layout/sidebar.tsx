"use client";

import { usePathname } from "next/navigation";

import { NavTree } from "@/components/layout/nav-tree";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-[var(--stroke)] lg:bg-[var(--surface)]">
      <div className="border-b border-[var(--stroke)] px-5 py-6">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-[-0.02em] text-[var(--ink)]">
          Scent Syntax
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Inventory &amp; Profit
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavTree pathname={pathname} />
      </div>
    </aside>
  );
}
