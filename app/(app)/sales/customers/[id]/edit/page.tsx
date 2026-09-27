import { notFound } from "next/navigation";

import { CustomerForm } from "@/components/sales/customer-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, messenger_contact, notes, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!customer) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit customer"
        description={customer.name}
        backHref="/sales/customers"
        backLabel="Customers"
      />
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        defaultValues={{
          name: customer.name,
          phone: customer.phone ?? "",
          messenger_contact: customer.messenger_contact ?? "",
          notes: customer.notes ?? "",
          is_active: customer.is_active,
        }}
      />
    </div>
  );
}
