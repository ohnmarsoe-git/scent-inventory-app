import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setCustomerActive } from "@/lib/actions/customers";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass, formatMmk } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("id, name, phone, messenger_contact, notes, is_active")
    .order("name");
  if (!showArchived) query = query.eq("is_active", true);
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,messenger_contact.ilike.%${q}%`,
    );
  }

  const { data: customers, error } = await query;

  // Outstanding balances from open sales
  const { data: openSales } = await supabase
    .from("sales")
    .select("customer_id, remaining_amount_mmk, total_mmk, paid_amount_mmk")
    .eq("is_voided", false)
    .gt("remaining_amount_mmk", 0);

  const outstandingByCustomer = new Map<string, number>();
  const paidByCustomer = new Map<string, number>();
  const purchaseByCustomer = new Map<string, number>();

  const { data: allSales } = await supabase
    .from("sales")
    .select("customer_id, total_mmk, paid_amount_mmk")
    .eq("is_voided", false)
    .not("customer_id", "is", null);

  for (const sale of allSales ?? []) {
    if (!sale.customer_id) continue;
    purchaseByCustomer.set(
      sale.customer_id,
      (purchaseByCustomer.get(sale.customer_id) ?? 0) + Number(sale.total_mmk),
    );
    paidByCustomer.set(
      sale.customer_id,
      (paidByCustomer.get(sale.customer_id) ?? 0) + Number(sale.paid_amount_mmk),
    );
  }
  for (const sale of openSales ?? []) {
    if (!sale.customer_id) continue;
    outstandingByCustomer.set(
      sale.customer_id,
      (outstandingByCustomer.get(sale.customer_id) ?? 0) +
        Number(sale.remaining_amount_mmk),
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Optional — walk-in sales can skip customer."
        actionHref="/sales/customers/new"
        actionLabel="Add customer"
        backHref="/sales"
        backLabel="Sales"
      />
      <Suspense fallback={null}>
        <SearchFilter placeholder="Search customers…" />
      </Suspense>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !customers?.length ? (
        <EmptyState
          title="No customers yet"
          description="Add customers when you need balances and history."
        />
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {[customer.phone, customer.messenger_contact]
                      .filter(Boolean)
                      .join(" · ") || "No contact"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Purchases {formatMmk(purchaseByCustomer.get(customer.id) ?? 0)}{" "}
                    · Paid {formatMmk(paidByCustomer.get(customer.id) ?? 0)} · Due{" "}
                    {formatMmk(outstandingByCustomer.get(customer.id) ?? 0)}
                  </p>
                </div>
                <StatusPill active={customer.is_active} />
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/sales/customers/${customer.id}/edit`}
                  className={btnSecondaryClass}
                >
                  Edit
                </Link>
                <ArchiveToggleButton
                  id={customer.id}
                  active={customer.is_active}
                  action={setCustomerActive}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
