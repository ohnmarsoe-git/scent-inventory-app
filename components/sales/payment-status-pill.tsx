import { cn } from "@/lib/ui";
import { PAYMENT_STATUS_LABELS } from "@/lib/validations/sales";

const tone: Record<string, string> = {
  unpaid: "text-[var(--danger)]",
  partial: "text-[var(--accent)]",
  paid: "text-[var(--success)]",
  overpaid: "text-[var(--accent)]",
};

export function PaymentStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium",
        tone[status] ?? "text-[var(--ink-soft)]",
      )}
    >
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}
