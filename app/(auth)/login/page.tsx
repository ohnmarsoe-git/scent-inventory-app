"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-none">
        <p className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Scent Syntax
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in to manage inventory, sales, and profit.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Password
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
          Create the first user in the Supabase Auth dashboard, then run the
          SQL migration in <code>supabase/migrations</code>.
        </p>
      </div>
    </div>
  );
}
