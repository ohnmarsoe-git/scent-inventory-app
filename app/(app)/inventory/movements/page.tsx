import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQty(quantity: number, unit: string) {
  const rounded = Math.round(quantity * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} ${unit}`;
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
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Unit cost</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((move) => {
                  const item = asOne(move.inventory_items);
                  const qty = Number(move.quantity);
                  return (
                    <tr
                      key={move.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatWhen(move.moved_at)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {move.movement_type}
                      </td>
                      <td className="max-w-[14rem] px-4 py-3">
                        {movementItemLabel(item)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatQty(qty, move.unit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatMmk(Number(move.unit_cost_mmk))}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMmk(Number(move.total_cost_mmk))}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3 text-[var(--muted)]">
                        {move.notes?.trim() || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {movements.map((move) => {
              const item = asOne(move.inventory_items);
              const qty = Number(move.quantity);
              return (
                <div
                  key={move.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{move.movement_type}</p>
                      <p className="mt-1">{movementItemLabel(item)}</p>
                    </div>
                    <p className="tabular-nums text-[var(--ink-soft)]">
                      {formatQty(qty, move.unit)}
                    </p>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    {formatWhen(move.moved_at)} ·{" "}
                    {formatMmk(Number(move.total_cost_mmk))}
                    {move.notes?.trim() ? ` · ${move.notes.trim()}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
