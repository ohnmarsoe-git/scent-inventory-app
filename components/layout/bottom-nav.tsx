"use client";

import { usePathname } from "next/navigation";

import { useNavMenu } from "@/components/layout/nav-menu-context";
import { NavLink } from "@/components/layout/nav-link";
import { mobileNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

/** Phone-only quick bar. iPad/tablet use the header menu drawer instead. */
export function BottomNav() {
  const pathname = usePathname();
  const { openMenu } = useNavMenu();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--stroke)] bg-[var(--surface)]/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {mobileNav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <NavLink
                href={item.href}
                prefetch
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                  active ? "text-[var(--accent)]" : "text-[var(--muted)]",
                )}
              >
                <span
                  className={cn(
                    "h-1 w-4 rounded-full",
                    active ? "bg-[var(--accent)]" : "bg-transparent",
                  )}
                />
                {item.label}
              </NavLink>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-[var(--muted)]"
            onClick={openMenu}
          >
            <span className="h-1 w-4 rounded-full bg-transparent" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
