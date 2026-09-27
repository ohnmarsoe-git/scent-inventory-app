import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: perfumes }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("perfumes")
      .select("id, name, default_bottle_size_ml, brands(name)")
      .eq("is_active", true)
      .order("name"),
  ]);

  const perfumeOptions = (perfumes ?? []).map((p) => {
    const brand =
      p.brands && typeof p.brands === "object" && "name" in p.brands
        ? String(p.brands.name)
        : "";
    return {
      id: p.id,
      name: brand ? `${brand} — ${p.name}` : p.name,
      default_bottle_size_ml: Number(p.default_bottle_size_ml),
    };
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New purchase order"
        description="Creates a draft. Mark Ordered when you place the order with the supplier."
        backHref="/purchasing/orders"
        backLabel="Purchase orders"
      />
      <PurchaseOrderForm
        mode="create"
        suppliers={suppliers ?? []}
        perfumes={perfumeOptions}
      />
    </div>
  );
}
