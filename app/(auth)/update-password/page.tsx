"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { updatePassword } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updatePassword(formData);
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-none">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.02em] text-[var(--ink)]">
          Set new password
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Choose a new password for your account.
        </p>

        {!ready ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Checking session…</p>
        ) : !hasSession ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-[var(--danger)]" role="alert">
              This reset link is invalid or expired. Request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="btn-primary inline-flex w-full justify-center"
            >
              Request reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                New password
              </span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
                className="w-full border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Confirm password
              </span>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
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
              {pending ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
