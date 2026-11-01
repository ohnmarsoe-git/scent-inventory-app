import { redirect } from "next/navigation";

/** Brand create happens on Add perfume. */
export default function NewBrandRedirectPage() {
  redirect("/inventory/perfumes/new");
}
