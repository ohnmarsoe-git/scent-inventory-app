import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cookie/JWT only — no Auth network round-trip. Middleware already gates access.
  // Blocking getUser() here left iPad PWAs on a blank shell for a long time.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return <AppShell userEmail={session?.user?.email}>{children}</AppShell>;
}
