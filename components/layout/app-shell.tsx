import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileFab } from "@/components/layout/mobile-fab";
import { NavMenuProvider } from "@/components/layout/nav-menu-context";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { Sidebar } from "@/components/layout/sidebar";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string | null;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="flex min-h-full bg-[var(--canvas)] text-[var(--ink)]">
      <ServiceWorkerRegister />
      <NavigationProgress />
      <Sidebar />
      <NavMenuProvider>
        <div className="flex min-h-full min-w-0 flex-1 flex-col">
          <AppHeader userEmail={userEmail} />
          <main className="flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-10 lg:px-8">
            {children}
          </main>
          <MobileFab />
          <BottomNav />
        </div>
      </NavMenuProvider>
    </div>
  );
}
