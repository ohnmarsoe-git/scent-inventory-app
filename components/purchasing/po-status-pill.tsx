import { cn } from "@/lib/ui";
import { PO_STATUS_LABELS } from "@/lib/validations/purchasing";

const tone: Record<string, string> = {
  draft: "text-[var(--muted)]",
  ordered: "text-[var(--accent)]",
  partially_received: "text-[var(--accent)]",
  received: "text-[var(--success)]",
  cancelled: "text-[var(--danger)]",
};

export function PoStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium",
        tone[status] ?? "text-[var(--ink-soft)]",
      )}
    >
      {PO_STATUS_LABELS[status] ?? status}
    </span>
  );
}
