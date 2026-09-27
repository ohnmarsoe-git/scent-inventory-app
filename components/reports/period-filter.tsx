import Link from "next/link";

import { btnSecondaryClass, fieldClass, labelClass } from "@/lib/ui";
import type { PeriodKey } from "@/lib/domain/pnl";

type PeriodFilterProps = {
  basePath: string;
  period: PeriodKey;
  from: string;
  to: string;
  /** Extra query params to keep when switching period (e.g. item search). */
  keepParams?: Record<string, string | undefined>;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "all_time", label: "All time" },
];

function withParams(
  basePath: string,
  period: PeriodKey,
  keepParams?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  params.set("period", period);
  for (const [key, value] of Object.entries(keepParams ?? {})) {
    if (value) params.set(key, value);
  }
  return `${basePath}?${params.toString()}`;
}

export function PeriodFilter({
  basePath,
  period,
  from,
  to,
  keepParams,
}: PeriodFilterProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={withParams(basePath, p.key, keepParams)}
            className={btnSecondaryClass}
            aria-current={period === p.key ? "page" : undefined}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form
        className="grid gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="period" value="custom" />
        {keepParams
          ? Object.entries(keepParams).map(([key, value]) =>
              value ? (
                <input key={key} type="hidden" name={key} value={value} />
              ) : null,
            )
          : null}
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
    </div>
  );
}
