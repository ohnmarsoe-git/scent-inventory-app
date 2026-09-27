import Link from "next/link";

import { btnSecondaryClass } from "@/lib/ui";

type ExportLinkProps = {
  href: string;
  label?: string;
};

export function ExportLink({ href, label = "Export CSV" }: ExportLinkProps) {
  return (
    <Link href={href} className={btnSecondaryClass} prefetch={false}>
      {label}
    </Link>
  );
}
