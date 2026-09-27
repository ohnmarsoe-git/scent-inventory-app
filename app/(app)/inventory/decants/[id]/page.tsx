import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { asOne, perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { formatMmk } from "@/lib/ui";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DecantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: decant } = await supabase
    .from("decant_transactions")
    .select(
      "*, perfumes(name, brands(name)), decant_items(*, decant_consumable_usages(*, consumables(name)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (!decant) notFound();

  const items = Array.isArray(decant.decant_items) ? decant.decant_items : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title={decant.decant_number}
        description={perfumeLabel(decant.perfumes)}
        backHref="/inventory/decants"
        backLabel="Decants"
      />

      <section className="grid gap-3 border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[var(--muted)]">Liquid used</p>
          <p className="mt-1 tabular-nums font-medium">
            {Number(decant.liquid_ml_used)} ml
          </p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Liquid cost / ml</p>
          <p className="mt-1 tabular-nums">
            {formatMmk(Number(decant.liquid_unit_cost_mmk))}
          </p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Liquid total cost</p>
          <p className="mt-1 tabular-nums font-medium">
            {formatMmk(Number(decant.liquid_total_cost_mmk))}
          </p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Created</p>
          <p className="mt-1">
            {new Date(decant.created_at).toLocaleString()}
          </p>
        </div>
        {decant.notes ? (
          <div className="sm:col-span-2">
            <p className="text-[var(--muted)]">Notes</p>
            <p className="mt-1">{decant.notes}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Outputs
        </h2>
        {items.map(
          (item: {
            id: string;
            size_ml: number;
            quantity: number;
            perfume_cost_mmk: number;
            packaging_cost_mmk: number;
            unit_cogs_mmk: number;
            total_cogs_mmk: number;
            decant_consumable_usages?: unknown;
          }) => {
            const usages = Array.isArray(item.decant_consumable_usages)
              ? item.decant_consumable_usages
              : [];
            return (
              <div
                key={item.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm"
              >
                <p className="font-medium">
                  {Number(item.size_ml)} ml × {Number(item.quantity)} units
                </p>
                <p className="mt-2 text-[var(--muted)]">
                  Perfume cost {formatMmk(Number(item.perfume_cost_mmk))} ·
                  Packaging {formatMmk(Number(item.packaging_cost_mmk))}
                </p>
                <p className="mt-1">
                  Unit COGS{" "}
                  <span className="tabular-nums font-medium">
                    {formatMmk(Number(item.unit_cogs_mmk))}
                  </span>
                  <span className="mx-2 text-[var(--stroke)]">·</span>
                  Total{" "}
                  <span className="tabular-nums font-medium">
                    {formatMmk(Number(item.total_cogs_mmk))}
                  </span>
                </p>
                {usages.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-[var(--muted)]">
                    {usages.map(
                      (u: {
                        id: string;
                        quantity: number;
                        total_cost_mmk: number;
                        consumables?: unknown;
                      }) => {
                        const name =
                          asOne(u.consumables as { name?: string } | null)
                            ?.name ?? "Consumable";
                        return (
                          <li key={u.id}>
                            {name}: {Number(u.quantity)} ·{" "}
                            {formatMmk(Number(u.total_cost_mmk))}
                          </li>
                        );
                      },
                    )}
                  </ul>
                ) : null}
              </div>
            );
          },
        )}
      </section>
    </div>
  );
}
