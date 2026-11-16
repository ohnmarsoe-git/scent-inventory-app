import { PerfumeForm } from "@/components/masters/perfume-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function NewPerfumePage() {
  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New perfume"
        description="Set the sealed bottle size (5 / 7.5 / 15ml mini, or larger). Cost is recorded when you receive stock."
        backHref="/inventory/perfumes"
        backLabel="Perfumes"
      />
      <PerfumeForm mode="create" brands={brands ?? []} />
    </div>
  );
}
