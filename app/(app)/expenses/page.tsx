import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { asOne } from "@/lib/supabase/relations";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/sales";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(
      "id, expense_number, expense_date, description, amount_mmk, payment_method, notes, expense_categories(name)",
    )
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `description.ilike.%${q}%,expense_number.ilike.%${q}%`,
    );
  }

  const { data: expenses, error } = await query;
  const total = (expenses ?? []).reduce(
    (s, e) => s + Number(e.amount_mmk),
    0,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Expenses"
        description="Operating costs — kept separate from product COGS."
        actionHref="/expenses/new"
        actionLabel="New expense"
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/expenses/pnl" className={btnSecondaryClass}>
          Profit &amp; Loss
        </Link>
      </div>

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search expenses…" showArchivedToggle={false} />
      </Suspense>

      <div className="border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--muted)]">Listed total: </span>
        <span className="font-medium tabular-nums">{formatMmk(total)}</span>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !expenses?.length ? (
        <EmptyState
          title="No expenses yet"
          description="Record advertising, delivery, fees, and other operating costs."
        />
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const category =
              asOne(expense.expense_categories as { name?: string } | null)
                ?.name ?? "—";
            return (
              <div
                key={expense.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {expense.expense_number} · {expense.description}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {expense.expense_date} · {category} ·{" "}
                      {PAYMENT_METHOD_LABELS[expense.payment_method] ??
                        expense.payment_method}
                    </p>
                  </div>
                  <p className="tabular-nums font-medium">
                    {formatMmk(Number(expense.amount_mmk))}
                  </p>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/expenses/${expense.id}/edit`}
                    className={btnSecondaryClass}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
