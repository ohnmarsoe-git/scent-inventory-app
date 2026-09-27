import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function NewExpensePage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: pos }] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("purchase_orders")
      .select("id, po_number")
      .neq("status", "cancelled")
      .order("order_date", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="New expense"
        description="Operating expense only — not product/packaging COGS."
        backHref="/expenses"
        backLabel="Expenses"
      />
      <ExpenseForm
        mode="create"
        categories={categories ?? []}
        purchaseOrders={(pos ?? []).map((p) => ({
          id: p.id,
          name: p.po_number,
        }))}
      />
    </div>
  );
}
