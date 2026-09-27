import { TesterForm } from "@/components/inventory/tester-form";
import { PageHeader } from "@/components/ui/page-header";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB");
}

function formatMl(value: number) {
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })} ml`;
}

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
      .select("id, moved_at, quantity, total_cost_mmk, notes, unit_cost_mmk")
      .eq("movement_type", "SAMPLE")
      .order("moved_at", { ascending: false })
      .limit(40),
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
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Testers"
        description="Write off millilitres that are not sold — 2ml/3ml pours or leftover in a bottle (e.g. 2.5ml). Stock goes down and the perfume cost counts as tester expense."
        backHref="/inventory"
        backLabel="Inventory"
      />

      <div className="max-w-xl">
        <TesterForm sources={sources} />
      </div>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Recent testers
        </h2>
        {error ? (
          <p className="text-sm text-[var(--danger)]">{error.message}</p>
        ) : !samples?.length ? (
          <p className="text-sm text-[var(--muted)]">No testers recorded yet.</p>
        ) : (
          <>
            <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Item / note</th>
                    <th className="px-4 py-3 font-medium">ml</th>
                    <th className="px-4 py-3 font-medium">Cost / ml</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((sample) => {
                    const ml = Math.abs(Number(sample.quantity));
                    const cost = Math.abs(Number(sample.total_cost_mmk));
                    const unitCost = Number(sample.unit_cost_mmk);
                    return (
                      <tr
                        key={sample.id}
                        className="border-b border-[var(--stroke)] last:border-0"
                      >
                        <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                          {formatDate(sample.moved_at)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {sample.notes || "Tester"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                          {formatMl(ml)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                          {Number.isFinite(unitCost) && unitCost > 0
                            ? formatMmk(unitCost)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatMmk(cost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {samples.map((sample) => {
                const ml = Math.abs(Number(sample.quantity));
                const cost = Math.abs(Number(sample.total_cost_mmk));
                return (
                  <div
                    key={sample.id}
                    className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
                  >
                    <p className="font-medium">{sample.notes || "Tester"}</p>
                    <p className="mt-1 tabular-nums text-[var(--muted)]">
                      {formatDate(sample.moved_at)} · {formatMl(ml)} ·{" "}
                      {formatMmk(cost)}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
