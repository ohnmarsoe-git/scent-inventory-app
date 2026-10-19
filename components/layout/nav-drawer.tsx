"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { NavTree } from "@/components/layout/nav-tree";
import { btnSecondaryClass } from "@/lib/ui";

type NavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--ink)]/45"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        id="app-nav-drawer"
        className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-[var(--stroke)] bg-[var(--surface)] shadow-[8px_0_32px_rgba(20,22,26,0.12)] md:w-80"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] px-5 py-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[-0.02em] text-[var(--ink)]">
              Scent Syntax
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Menu
            </p>
          </div>
          <button type="button" className={btnSecondaryClass} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <NavTree pathname={pathname} onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}
