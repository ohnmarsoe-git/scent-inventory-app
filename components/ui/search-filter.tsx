"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { fieldClass } from "@/lib/ui";

type SearchFilterProps = {
  placeholder?: string;
  showArchivedToggle?: boolean;
  showOutOfStockToggle?: boolean;
};

export function SearchFilter({
  placeholder = "Search…",
  showArchivedToggle = true,
  showOutOfStockToggle = false,
}: SearchFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const qParam = searchParams.get("q") ?? "";
  const archived = searchParams.get("archived") === "1";
  const outOfStock = searchParams.get("stock") === "out";
  const [q, setQ] = useState(qParam);

  useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (q === qParam) return;
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [q, qParam, router, searchParams]);

  function updateParam(key: string, enabled: boolean, value = "1") {
    const params = new URLSearchParams(searchParams.toString());
    if (enabled) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        enterKeyHint="search"
        className={`${fieldClass} min-h-11 sm:max-w-sm`}
        onChange={(e) => setQ(e.target.value)}
        aria-busy={pending}
      />
      {showArchivedToggle ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={archived}
            onChange={(e) => updateParam("archived", e.target.checked)}
          />
          Show archived
        </label>
      ) : null}
      {showOutOfStockToggle ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--ink-soft)]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={outOfStock}
            onChange={(e) =>
              updateParam("stock", e.target.checked, "out")
            }
          />
          Out of stock
        </label>
      ) : null}
    </div>
  );
}
