import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

export default async function MovementsPage() {
  const supabase = await createClient();
  const { data: movements, error } = await supabase
    .from("inventory_movements")
    .select(
      "id, moved_at, movement_type, quantity, unit, unit_cost_mmk, total_cost_mmk, notes, inventory_items(item_type, size_ml, perfumes(name, brands(name)), consumables(name))",
    )
    .order("moved_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Stock movements"
        description="Audit trail of inventory changes."
        backHref="/inventory"
        backLabel="Inventory"
      />

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !movements?.length ? (
        <EmptyState
          title="No movements yet"
          description="Receiving stock creates PURCHASE_RECEIPT movements."
        />
      ) : (
        <div className="space-y-3">
          {movements.map((move) => {
            const item = asOne(move.inventory_items);
            const label = movementItemLabel(item);
            return (
              <div
                key={move.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--ink)]">
                      {move.movement_type}
                    </p>
                    <p className="mt-1 text-[var(--muted)]">{label}</p>
                  </div>
                  <p className="tabular-nums text-[var(--ink-soft)]">
                    {Number(move.quantity) > 0 ? "+" : ""}
                    {Number(move.quantity)} {move.unit}
                  </p>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  {new Date(move.moved_at).toLocaleString()} · cost{" "}
                  {formatMmk(Number(move.total_cost_mmk))}
                  {move.notes ? ` · ${move.notes}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function movementItemLabel(
  item: {
    item_type?: string;
    size_ml?: number | null;
    perfumes?: unknown;
    consumables?: unknown;
  } | null,
) {
  if (!item) return "Inventory item";
  if (item.item_type === "CONSUMABLE") {
    return (
      asOne(item.consumables as { name?: string } | null)?.name ?? "Consumable"
    );
  }
  const base = perfumeLabel(item.perfumes);
  if (item.item_type === "DECANT") return `${base} (${item.size_ml}ml)`;
  return `${base} (liquid)`;
}
