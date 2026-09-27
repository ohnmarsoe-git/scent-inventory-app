/** Supabase nested selects may return an object or a one-element array. */
export function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function perfumeLabel(perfume: unknown): string {
  const p = asOne(
    perfume as
      | { name?: string; brands?: { name?: string } | { name?: string }[] }
      | null,
  );
  if (!p) return "Perfume";
  const brand = asOne(p.brands)?.name;
  return brand ? `${brand} — ${p.name ?? "Perfume"}` : (p.name ?? "Perfume");
}

export function supplierName(supplier: unknown): string {
  return asOne(supplier as { name?: string } | null)?.name ?? "—";
}
