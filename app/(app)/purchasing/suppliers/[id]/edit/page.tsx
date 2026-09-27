import { notFound } from "next/navigation";

import { SupplierForm } from "@/components/masters/supplier-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, phone, contact, notes, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!supplier) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit supplier"
        description={supplier.name}
        backHref="/purchasing/suppliers"
        backLabel="Suppliers"
      />
      <SupplierForm
        mode="edit"
        supplierId={supplier.id}
        defaultValues={{
          name: supplier.name,
          phone: supplier.phone ?? "",
          contact: supplier.contact ?? "",
          notes: supplier.notes ?? "",
          is_active: supplier.is_active,
        }}
      />
    </div>
  );
}
