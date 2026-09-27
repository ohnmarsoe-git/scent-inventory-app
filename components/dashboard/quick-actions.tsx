import Link from "next/link";

import { quickActions } from "@/lib/constants/navigation";

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
      {quickActions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex min-h-12 items-center justify-center border border-[var(--stroke)] bg-[var(--surface)] px-3 py-3 text-center text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--canvas)]"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
