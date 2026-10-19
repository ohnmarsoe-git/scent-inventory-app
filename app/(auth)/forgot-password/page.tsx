"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail(String(formData.get("email") ?? ""));
      setSent(true);
    });
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-none">
        <p className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.02em] text-[var(--ink)]">
          Forgot password
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter your email and we&apos;ll send a reset link.
        </p>

        {sent ? (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-[var(--ink)]" role="status">
              If an account exists for <strong>{email}</strong>, a reset link
              is on its way. Check your inbox (and spam).
            </p>
            <Link
              href="/login"
              className="btn-secondary inline-flex w-full justify-center"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
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
              {pending ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-sm text-[var(--muted)]">
              <Link
                href="/login"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
