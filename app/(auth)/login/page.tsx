"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { signInWithPassword } from "@/lib/actions/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await signInWithPassword(formData);
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-none">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.02em] text-[var(--ink)]">
          Scent Syntax
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in to continue.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="w-full border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Password
              <Link
                href="/forgot-password"
                className="normal-case tracking-normal text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Forgot password?
              </Link>
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
