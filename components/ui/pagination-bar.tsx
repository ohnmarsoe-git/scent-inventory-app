"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { DEFAULT_PAGE_SIZE, totalPages } from "@/lib/pagination";
import { btnSecondaryClass, cn } from "@/lib/ui";

type PaginationBarProps = {
  total: number;
  pageSize?: number;
  /** Current 1-based page; defaults to `page` search param. */
  page?: number;
  className?: string;
};

export function PaginationBar({
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  page: pageProp,
  className,
}: PaginationBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramPage = Number(searchParams.get("page") ?? "1");
  const page =
    pageProp ??
    (Number.isFinite(paramPage) && paramPage >= 1 ? Math.floor(paramPage) : 1);
  const pages = totalPages(total, pageSize);

  if (total <= pageSize) return null;

  const safePage = Math.min(Math.max(page, 1), pages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  function hrefFor(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= pages;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {prevDisabled ? (
          <span className={`${btnSecondaryClass} pointer-events-none opacity-40`}>
            Previous
          </span>
        ) : (
          <Link href={hrefFor(safePage - 1)} className={btnSecondaryClass}>
            Previous
          </Link>
        )}
        <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-[var(--ink-soft)]">
          Page {safePage} / {pages}
        </span>
        {nextDisabled ? (
          <span className={`${btnSecondaryClass} pointer-events-none opacity-40`}>
            Next
          </span>
        ) : (
          <Link href={hrefFor(safePage + 1)} className={btnSecondaryClass}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
