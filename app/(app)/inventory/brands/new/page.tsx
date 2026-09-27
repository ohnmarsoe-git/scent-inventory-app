import { BrandForm } from "@/components/masters/brand-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewBrandPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New brand"
        description="Add a brand to the perfume catalog."
        backHref="/inventory/brands"
        backLabel="Brands"
      />
      <BrandForm mode="create" />
    </div>
  );
}
