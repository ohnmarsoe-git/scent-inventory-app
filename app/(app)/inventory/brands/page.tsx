import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ q?: string; archived?: string }>;
};

/** Brands live on the Perfumes page now. */
export default async function BrandsRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = new URLSearchParams();
  if (params.q?.trim()) next.set("q", params.q.trim());
  if (params.archived === "1") next.set("archived", "1");
  const query = next.toString();
  redirect(query ? `/inventory/perfumes?${query}` : "/inventory/perfumes");
}
