import { notFound } from "next/navigation";

import { PerfumeForm } from "@/components/masters/perfume-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPerfumePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: perfume }, { data: brands }] = await Promise.all([
    supabase
      .from("perfumes")
      .select(
        "id, brand_id, name, product_type, default_bottle_size_ml, notes, is_active",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("brands")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (!perfume) notFound();

  const brandOptions = brands ?? [];
  if (
    perfume.brand_id &&
    !brandOptions.some((b) => b.id === perfume.brand_id)
  ) {
    const { data: currentBrand } = await supabase
      .from("brands")
      .select("id, name")
      .eq("id", perfume.brand_id)
      .maybeSingle();
    if (currentBrand) brandOptions.unshift(currentBrand);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit perfume"
        description={perfume.name}
        backHref="/inventory/perfumes"
        backLabel="Perfumes"
      />
      <PerfumeForm
        mode="edit"
        perfumeId={perfume.id}
        brands={brandOptions}
        defaultValues={{
          brand_id: perfume.brand_id,
          name: perfume.name,
          product_type: perfume.product_type,
          default_bottle_size_ml: Number(perfume.default_bottle_size_ml),
          notes: perfume.notes ?? "",
          is_active: perfume.is_active,
        }}
      />
    </div>
  );
}
