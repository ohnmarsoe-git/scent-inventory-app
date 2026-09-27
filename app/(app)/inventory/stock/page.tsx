import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

export default async function StockPage() {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("inventory_items")
    .select(
      "id, item_type, quantity_on_hand, avg_unit_cost_mmk, unit, size_ml, perfumes(name, brands(name)), consumables(name)",
    )
    .gt("quantity_on_hand", 0)
    .order("item_type")
    .order("updated_at", { ascending: false });

  const rows = items ?? [];
  const totalValue = rows.reduce(
    (sum, item) =>
      sum + Number(item.quantity_on_hand) * Number(item.avg_unit_cost_mmk),
    0,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Stock on hand"
        description="Current perfume liquid, decants, and consumable balances."
        backHref="/inventory"
        backLabel="Inventory"
      />

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--muted)]">Inventory value: </span>
        <span className="font-medium tabular-nums">{formatMmk(totalValue)}</span>
        <span className="mx-2 text-[var(--stroke)]">·</span>
        <a href="/inventory/movements" className="text-[var(--accent)] underline">
          View movements
        </a>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !rows.length ? (
        <EmptyState
          title="No stock yet"
          description="Receive a purchase order to add perfume liquid (ml) to inventory."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Avg cost</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const label = stockLabel(item);
                  const qty = Number(item.quantity_on_hand);
                  const avg = Number(item.avg_unit_cost_mmk);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--stroke)] last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{label}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {item.item_type}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {qty} {item.unit}
                        {item.size_ml ? ` (${item.size_ml}ml)` : ""}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--muted)]">
                        {formatMmk(avg)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatMmk(qty * avg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((item) => {
              const qty = Number(item.quantity_on_hand);
              const avg = Number(item.avg_unit_cost_mmk);
              return (
                <div
                  key={item.id}
                  className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
                >
                  <p className="font-medium">{stockLabel(item)}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {item.item_type} · {qty} {item.unit}
                  </p>
                  <p className="mt-1 text-sm tabular-nums">
                    {formatMmk(qty * avg)}{" "}
                    <span className="text-[var(--muted)]">
                      ({formatMmk(avg)}/{item.unit})
                    </span>
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

function stockLabel(item: {
  item_type: string;
  size_ml: number | null;
  perfumes?: unknown;
  consumables?: unknown;
}) {
  if (item.item_type === "CONSUMABLE") {
    return (
      asOne(item.consumables as { name?: string } | null)?.name ?? "Consumable"
    );
  }
  const base = perfumeLabel(item.perfumes);
  if (item.item_type === "DECANT") {
    return `${base} (${item.size_ml}ml decant)`;
  }
  return `${base} (liquid)`;
}
