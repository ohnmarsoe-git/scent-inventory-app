"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { primaryNav } from "@/lib/constants/navigation";
import { btnSecondaryClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

const HIDDEN = new Set(["/"]);

export function MobileMoreMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = primaryNav.filter((item) => !HIDDEN.has(item.href) && !item.group);

  return (
    <>
      <button
        type="button"
        className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[var(--muted)]"
        aria-expanded={open}
        aria-controls="mobile-more-sheet"
        onClick={() => setOpen(true)}
      >
        <span className="h-1 w-4 rounded-full bg-transparent" />
        More
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--ink)]/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-more-sheet"
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto border-t border-[var(--stroke)] bg-[var(--surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                More
              </p>
              <button
                type="button"
                className={btnSecondaryClass}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {links.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex min-h-12 items-center border border-[var(--stroke)] px-3 py-3 text-sm",
                        active
                          ? "btn-primary border border-[var(--ink)]"
                          : "bg-[var(--canvas)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
