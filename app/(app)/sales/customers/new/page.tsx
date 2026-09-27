import { CustomerForm } from "@/components/sales/customer-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New customer"
        description="Optional contact for credit and history."
        backHref="/sales/customers"
        backLabel="Customers"
      />
      <CustomerForm mode="create" />
    </div>
  );
}
