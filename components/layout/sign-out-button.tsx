"use client";

import { useTransition } from "react";

import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      className="rounded-md border border-[var(--stroke)] px-3 py-1.5 text-sm text-[var(--ink-soft)] transition hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
