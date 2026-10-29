import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import {
  PurchaseOrdersList,
  type PurchaseOrderListRow,
} from "@/components/purchasing/purchase-orders-list";
import { PreorderMoney } from "@/components/purchasing/preorder-money";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass } from "@/lib/ui";

function statusHref(status: string, q: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/purchasing/orders?${query}` : "/purchasing/orders";
}

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string; status?: string }>;
};

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";

  const supabase = await createClient();

  let matchedIds: string[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    const [byNumber, byPerfume, byBrand, bySupplier] = await Promise.all([
      supabase.from("purchase_orders").select("id").ilike("po_number", pattern),
      supabase
        .from("purchase_order_items")
        .select("purchase_order_id, perfumes!inner(name)")
        .ilike("perfumes.name", pattern),
      supabase
        .from("purchase_order_items")
        .select("purchase_order_id, perfumes!inner(brands!inner(name))")
        .ilike("perfumes.brands.name", pattern),
      supabase
        .from("purchase_orders")
        .select("id, suppliers!inner(name)")
        .ilike("suppliers.name", pattern),
    ]);

    matchedIds = [
      ...new Set(
        [
          ...(byNumber.data ?? []).map((row) => row.id),
          ...(byPerfume.data ?? []).map((row) => row.purchase_order_id),
          ...(byBrand.data ?? []).map((row) => row.purchase_order_id),
          ...(bySupplier.data ?? []).map((row) => row.id),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  let query = supabase
    .from("purchase_orders")
    .select(
      "id, po_number, order_date, status, currency, total_mmk, deposit_paid_mmk, total_original, suppliers(name), purchase_order_items(quantity, bottle_size_ml, perfumes(name, brands(name)))",
    )
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (matchedIds) {
    if (!matchedIds.length) {
      return (
        <PurchaseOrdersShell q={q} status={status}>
          <EmptyState
            title="No matching purchase orders"
            description="Try another PO number, supplier, or item name."
          />
        </PurchaseOrdersShell>
      );
    }
    query = query.in("id", matchedIds);
  }

  const { data: orders, error } = await query;

  return (
    <PurchaseOrdersShell q={q} status={status}>
      {!error ? <PreorderMoney /> : null}

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !orders?.length ? (
        <EmptyState
          title="No purchase orders"
          description="Create a draft PO, mark it ordered, then receive stock."
        />
      ) : (
        <PurchaseOrdersList orders={orders as PurchaseOrderListRow[]} />
      )}
    </PurchaseOrdersShell>
  );
}

function PurchaseOrdersShell({
  q,
  status,
  children,
}: {
  q: string;
  status: string;
  children: ReactNode;
}) {
  const filters = [
    { status: "", label: "All" },
    { status: "draft", label: "Draft" },
    { status: "ordered", label: "Ordered" },
    { status: "partially_received", label: "Partial" },
    { status: "received", label: "Received" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Purchase orders"
        description="Pre-orders stay Ordered until the bottle arrives. Paid money is invested in that stock. Left to pay is still owed."
        actionHref="/purchasing/orders/new"
        actionLabel="New PO"
        backHref="/purchasing"
        backLabel="Purchasing"
      />

      <Suspense fallback={null}>
        <SearchFilter
          placeholder="Search PO number, supplier, or item…"
          showArchivedToggle={false}
        />
      </Suspense>

      <div className="flex flex-wrap gap-2 text-sm">
        {filters.map((item) => {
          const active = status === item.status || (!status && !item.status);
          return (
            <Link
              key={item.label}
              href={statusHref(item.status, q)}
              className={btnSecondaryClass}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
