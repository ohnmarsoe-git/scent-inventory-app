import Link from "next/link";
import { Suspense } from "react";

import { ArchiveToggleButton } from "@/components/masters/archive-toggle-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter } from "@/components/ui/search-filter";
import { StatusPill } from "@/components/ui/status-pill";
import { setSupplierActive } from "@/lib/actions/suppliers";
import { createClient } from "@/lib/supabase/server";
import { btnSecondaryClass } from "@/lib/ui";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

export default async function SuppliersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showArchived = params.archived === "1";

  const supabase = await createClient();
  let query = supabase
    .from("suppliers")
    .select("id, name, phone, contact, notes, is_active")
    .order("name");

  if (!showArchived) query = query.eq("is_active", true);
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,contact.ilike.%${q}%`,
    );
  }

  const { data: suppliers, error } = await query;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Suppliers"
        description="Where you buy perfume and packaging."
        actionHref="/purchasing/suppliers/new"
        actionLabel="Add supplier"
        backHref="/purchasing"
        backLabel="Purchasing"
      />

      <Suspense fallback={null}>
        <SearchFilter placeholder="Search suppliers…" />
      </Suspense>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      ) : !suppliers?.length ? (
        <EmptyState
          title="No suppliers yet"
          description="Add suppliers before creating purchase orders."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden border border-[var(--stroke)] bg-[var(--surface)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--stroke)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{supplier.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {supplier.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {supplier.contact || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill active={supplier.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/purchasing/suppliers/${supplier.id}/edit`}
                          className={btnSecondaryClass}
                        >
                          Edit
                        </Link>
                        <ArchiveToggleButton
                          id={supplier.id}
                          active={supplier.is_active}
                          action={setSupplierActive}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="border border-[var(--stroke)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{supplier.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[supplier.phone, supplier.contact]
                        .filter(Boolean)
                        .join(" · ") || "No contact"}
                    </p>
                  </div>
                  <StatusPill active={supplier.is_active} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/purchasing/suppliers/${supplier.id}/edit`}
                    className={btnSecondaryClass}
                  >
                    Edit
                  </Link>
                  <ArchiveToggleButton
                    id={supplier.id}
                    active={supplier.is_active}
                    action={setSupplierActive}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
