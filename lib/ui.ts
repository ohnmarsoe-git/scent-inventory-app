import { cn, formatMmk } from "@/lib/utils";

export { cn, formatMmk };

export const fieldClass =
  "w-full border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)] disabled:opacity-60";

export const labelClass =
  "block text-xs uppercase tracking-[0.14em] text-[var(--muted)]";

export const btnPrimaryClass = "btn-primary";

export const btnSecondaryClass = "btn-secondary";

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  EDP: "Eau de Parfum",
  EDT: "Eau de Toilette",
  OTHER: "Other",
};

export const CONSUMABLE_CATEGORIES = [
  "Bottle",
  "Atomizer",
  "Cap",
  "Sticker",
  "Label",
  "Box",
  "Shopping Bag",
  "Packaging",
  "Other",
] as const;
