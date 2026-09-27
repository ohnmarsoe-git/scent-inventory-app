import { formatMmk } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: number;
  hint?: string;
  currency?: boolean;
  emphasize?: boolean;
};

export function MetricCard({
  label,
  value,
  hint,
  currency = true,
  emphasize = false,
}: MetricCardProps) {
  const display = currency
    ? formatMmk(Number.isFinite(value) ? value : 0)
    : Number(value || 0).toLocaleString("en-US");

  return (
    <div
      className={`border p-4 ${
        emphasize
          ? "border-[var(--accent)] bg-[var(--surface)]"
          : "border-[var(--stroke)] bg-[var(--surface)]"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl tabular-nums tracking-tight text-[var(--ink)] ${
          currency
            ? "font-[family-name:var(--font-display)]"
            : "font-[family-name:var(--font-body)] font-semibold"
        }`}
      >
        {display}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
