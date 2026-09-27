import { cn } from "@/lib/ui";

type StatusPillProps = {
  active: boolean;
};

export function StatusPill({ active }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-2 py-0.5 text-xs font-medium",
        active
          ? "bg-[var(--surface-2)] text-[var(--success)]"
          : "bg-[var(--surface-2)] text-[var(--muted)]",
      )}
    >
      {active ? "Active" : "Archived"}
    </span>
  );
}
