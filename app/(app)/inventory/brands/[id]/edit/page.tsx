import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Brand edit/rename/delete lives on the Perfumes page Brands panel. */
export default async function EditBrandRedirectPage({ params }: PageProps) {
  await params;
  redirect("/inventory/perfumes");
}
