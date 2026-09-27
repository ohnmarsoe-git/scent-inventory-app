import { ConsumableForm } from "@/components/masters/consumable-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function NewConsumablePage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New consumable"
        description="Packaging and materials used when making decants."
        backHref="/inventory/consumables"
        backLabel="Consumables"
      />
      <ConsumableForm mode="create" suppliers={suppliers ?? []} />
    </div>
  );
}
