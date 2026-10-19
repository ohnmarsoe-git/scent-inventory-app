"use client";

import { NavDrawer } from "@/components/layout/nav-drawer";
import { useNavMenu } from "@/components/layout/nav-menu-context";
import { SignOutButton } from "@/components/layout/sign-out-button";

type AppHeaderProps = {
  userEmail?: string | null;
};

export function AppHeader({ userEmail }: AppHeaderProps) {
  const { open, openMenu, closeMenu } = useNavMenu();

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--stroke)] bg-[var(--canvas)]/90 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-8">
        <div className="flex min-w-0 items-center gap-3 lg:hidden">
          <button
            type="button"
            className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center border border-[var(--stroke)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] md:min-w-[5.5rem] md:gap-2"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="app-nav-drawer"
            onClick={openMenu}
          >
            <span className="flex w-5 flex-col gap-1.5" aria-hidden>
              <span className="block h-0.5 w-full bg-current" />
              <span className="block h-0.5 w-full bg-current" />
              <span className="block h-0.5 w-full bg-current" />
            </span>
            <span className="hidden md:inline">Menu</span>
          </button>
          <p className="font-[family-name:var(--font-display)] truncate text-xl tracking-[-0.02em] text-[var(--ink)]">
            Scent Syntax
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {userEmail ? (
            <span className="hidden max-w-[14rem] truncate text-sm text-[var(--muted)] sm:inline">
              {userEmail}
            </span>
          ) : null}
          <SignOutButton />
        </div>
      </header>

      <NavDrawer open={open} onClose={closeMenu} />
    </>
  );
}
