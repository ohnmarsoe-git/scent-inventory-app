import Link from "next/link";

import { btnSecondaryClass, fieldClass, labelClass } from "@/lib/ui";
import type { PeriodKey } from "@/lib/domain/pnl";

type PeriodFilterProps = {
  basePath: string;
  period: PeriodKey;
  from: string;
  to: string;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
];

export function PeriodFilter({
  basePath,
  period,
  from,
  to,
}: PeriodFilterProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`${basePath}?period=${p.key}`}
            className={btnSecondaryClass}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form
        className="grid gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="period" value="custom" />
        <label className="block space-y-1.5">
          <span className={labelClass}>From</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>To</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className={fieldClass}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className={btnSecondaryClass}>
            Apply
          </button>
        </div>
      </form>
      {period === "custom" ? null : null}
    </div>
  );
}
