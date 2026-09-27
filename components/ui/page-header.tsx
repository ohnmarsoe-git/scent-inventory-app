import Link from "next/link";

import { btnPrimaryClass, btnSecondaryClass } from "@/lib/ui";

type PageHeaderProps = {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel,
  backHref,
  backLabel = "Back",
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 inline-block text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← {backLabel}
          </Link>
        ) : null}
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={btnPrimaryClass}>
          {actionLabel}
        </Link>
      ) : null}
      {!actionHref && backHref ? (
        <Link href={backHref} className={`${btnSecondaryClass} sm:hidden`}>
          {backLabel}
        </Link>
      ) : null}
    </div>
  );
}
