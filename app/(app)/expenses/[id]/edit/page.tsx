import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditExpensePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: expense }, { data: categories }, { data: pos }] =
    await Promise.all([
      supabase.from("expenses").select("*").eq("id", id).maybeSingle(),
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

  if (!expense) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Edit ${expense.expense_number}`}
        description={expense.description}
        backHref="/expenses"
        backLabel="Expenses"
      />
      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        categories={categories ?? []}
        purchaseOrders={(pos ?? []).map((p) => ({
          id: p.id,
          name: p.po_number,
        }))}
        defaultValues={{
          expense_date: expense.expense_date,
          category_id: expense.category_id,
          description: expense.description,
          amount_mmk: Number(expense.amount_mmk),
          payment_method: expense.payment_method,
          related_purchase_order_id: expense.related_purchase_order_id ?? "",
          notes: expense.notes ?? "",
        }}
      />
    </div>
  );
}
