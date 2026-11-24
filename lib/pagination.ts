/** Default rows per list page across the app. */
export const DEFAULT_PAGE_SIZE = 25;

export type PageWindow = {
  page: number;
  pageSize: number;
  /** Inclusive start index for Supabase `.range(from, to)`. */
  from: number;
  /** Inclusive end index for Supabase `.range(from, to)`. */
  to: number;
};

export function parsePageParam(
  raw: string | string[] | undefined | null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PageWindow {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  const page = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  const from = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
  };
}

export function totalPages(
  total: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): number {
  if (!(total > 0)) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Slice an in-memory filtered list (e.g. stock label search). */
export function pageSlice<T>(
  rows: T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): T[] {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const from = (safePage - 1) * pageSize;
  return rows.slice(from, from + pageSize);
}
