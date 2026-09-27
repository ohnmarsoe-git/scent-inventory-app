import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("costing_method, base_currency, allow_negative_stock")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Costing, currency, stock rules, and install options."
      />

      <InstallPrompt />

      <section className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
        <div className="flex justify-between gap-4 border-b border-[var(--stroke)] pb-3">
          <span className="text-[var(--muted)]">Costing method</span>
          <span className="font-medium text-[var(--ink)]">
            Weighted Average (WAC)
          </span>
        </div>
        <div className="flex justify-between gap-4 border-b border-[var(--stroke)] pb-3">
          <span className="text-[var(--muted)]">Base currency</span>
          <span className="font-medium text-[var(--ink)]">
            {settings?.base_currency ?? "MMK"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Costing code</span>
          <span className="font-medium text-[var(--ink)]">
            {settings?.costing_method ?? "WEIGHTED_AVERAGE"}
          </span>
        </div>
        <p className="pt-2 text-xs text-[var(--muted)]">
          Details in <code>lib/domain/costing/COSTING.md</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Stock rules
        </h2>
        <SettingsForm
          allowNegativeStock={Boolean(settings?.allow_negative_stock)}
        />
      </section>

      <section className="space-y-2 text-sm text-[var(--muted)]">
        <h2 className="text-xs uppercase tracking-[0.16em]">Install app</h2>
        <p>
          On Android Chrome: menu → <strong>Install app</strong>. On iPhone
          Safari: Share → <strong>Add to Home Screen</strong>.
        </p>
        <p>
          Production builds register a service worker for faster reloads and an
          offline notice when the network is unavailable.
        </p>
      </section>
    </div>
  );
}
