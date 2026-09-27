import { TesterForm } from "@/components/inventory/tester-form";
import { PageHeader } from "@/components/ui/page-header";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

export default async function TestersPage() {
  const supabase = await createClient();
  const [{ data: liquid }, { data: samples, error }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "perfume_id, quantity_on_hand, avg_unit_cost_mmk, perfumes(name, brands(name))",
      )
      .eq("item_type", "PERFUME_LIQUID")
      .gt("quantity_on_hand", 0)
      .order("updated_at", { ascending: false }),
    supabase
      .from("inventory_movements")
      .select("id, moved_at, quantity, total_cost_mmk, notes")
      .eq("movement_type", "SAMPLE")
      .order("moved_at", { ascending: false })
      .limit(30),
  ]);

  const sources = (liquid ?? [])
    .filter((item) => item.perfume_id)
    .map((item) => ({
      perfume_id: item.perfume_id as string,
      label: perfumeLabel(item.perfumes),
      quantity_ml: Number(item.quantity_on_hand),
      avg_cost_per_ml: Number(item.avg_unit_cost_mmk),
    }));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <PageHeader
        title="Testers"
        description="2ml or 3ml pours that are not sold. This takes the millilitres out of stock and counts the perfume cost."
        backHref="/inventory"
        backLabel="Inventory"
      />

      <TesterForm sources={sources} />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Recent testers
        </h2>
        {error ? (
          <p className="text-sm text-[var(--danger)]">{error.message}</p>
        ) : !samples?.length ? (
          <p className="text-sm text-[var(--muted)]">No testers recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm"
              >
                <p className="font-medium">{sample.notes || "Tester"}</p>
                <p className="mt-1 tabular-nums text-[var(--muted)]">
                  {Math.abs(Number(sample.quantity))} ml ·{" "}
                  {formatMmk(Math.abs(Number(sample.total_cost_mmk)))} ·{" "}
                  {String(sample.moved_at).slice(0, 10)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
