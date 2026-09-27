"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileMoreMenu } from "@/components/layout/mobile-more-menu";
import { mobileNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--stroke)] bg-[var(--surface)]/95 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {mobileNav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
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
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <MobileMoreMenu />
        </li>
      </ul>
    </nav>
  );
}
