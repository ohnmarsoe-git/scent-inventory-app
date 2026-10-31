import { notFound } from "next/navigation";

import { BundleSetForm } from "@/components/sales/bundle-set-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadBundlePerfumeOptions } from "@/lib/bundle-costs";
import { perfumeLabel } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBundleSetPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: bundle }, { perfumes, packagingCostBySize }] =
    await Promise.all([
      supabase
        .from("bundle_sets")
        .select(
          "id, name, size_ml, sale_price_mmk, notes, is_active, bundle_set_items(perfume_id, quantity, sort_order)",
        )
        .eq("id", id)
        .maybeSingle(),
      loadBundlePerfumeOptions(),
    ]);

  if (!bundle) notFound();

  const items = (
    Array.isArray(bundle.bundle_set_items) ? bundle.bundle_set_items : []
  )
    .slice()
    .sort(
      (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
    )
    .map((item) => ({
      perfume_id: item.perfume_id as string,
      quantity: Number(item.quantity) || 1,
    }));

  const options = [...perfumes];
  for (const item of items) {
    if (!options.some((p) => p.id === item.perfume_id)) {
      const { data: archived } = await supabase
        .from("perfumes")
        .select("id, name, brands(name)")
        .eq("id", item.perfume_id)
        .maybeSingle();
      if (archived) {
        options.unshift({
          id: archived.id,
          label: perfumeLabel(archived),
          cost_per_ml: null,
          ml_on_hand: 0,
        });
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader
        title="Edit bundle set"
        description={bundle.name}
        backHref="/sales/bundles"
        backLabel="Bundles"
      />
      <BundleSetForm
        mode="edit"
        bundleId={bundle.id}
        perfumes={options}
        packagingCostBySize={packagingCostBySize}
        defaultValues={{
          name: bundle.name,
          size_ml: Number(bundle.size_ml),
          sale_price_mmk: Number(bundle.sale_price_mmk),
          notes: bundle.notes ?? "",
          is_active: bundle.is_active,
          items,
        }}
      />
    </div>
  );
}
