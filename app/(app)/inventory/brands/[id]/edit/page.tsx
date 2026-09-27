import { notFound } from "next/navigation";

import { BrandForm } from "@/components/masters/brand-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBrandPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, notes, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!brand) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit brand"
        description={brand.name}
        backHref="/inventory/brands"
        backLabel="Brands"
      />
      <BrandForm
        mode="edit"
        brandId={brand.id}
        defaultValues={{
          name: brand.name,
          notes: brand.notes ?? "",
          is_active: brand.is_active,
        }}
      />
    </div>
  );
}
