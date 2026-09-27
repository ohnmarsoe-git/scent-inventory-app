import { SupplierForm } from "@/components/masters/supplier-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewSupplierPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New supplier"
        description="Add a perfume or packaging supplier."
        backHref="/purchasing/suppliers"
        backLabel="Suppliers"
      />
      <SupplierForm mode="create" />
    </div>
  );
}
