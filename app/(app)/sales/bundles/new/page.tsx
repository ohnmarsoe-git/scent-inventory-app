import { BundleSetForm } from "@/components/sales/bundle-set-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadBundlePerfumeOptions } from "@/lib/bundle-costs";

export default async function NewBundleSetPage() {
  const { perfumes, packagingCostBySize } = await loadBundlePerfumeOptions();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader
        title="New bundle set"
        description="Pick the decant size, the scents in the kit, and one sale price for the whole set."
        backHref="/sales/bundles"
        backLabel="Bundles"
      />
      <BundleSetForm
        mode="create"
        perfumes={perfumes}
        packagingCostBySize={packagingCostBySize}
      />
    </div>
  );
}
