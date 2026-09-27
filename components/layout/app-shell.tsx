import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileFab } from "@/components/layout/mobile-fab";
import { Sidebar } from "@/components/layout/sidebar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="flex min-h-full bg-[var(--canvas)] text-[var(--ink)]">
      <ServiceWorkerRegister />
      <Sidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--stroke)] bg-[var(--canvas)]/90 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-8">
          <div className="lg:hidden">
            <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
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
        <main className="flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10">{children}</main>
        <MobileFab />
        <BottomNav />
      </div>
    </div>
  );
}
