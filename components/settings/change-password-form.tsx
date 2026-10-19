"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { btnPrimaryClass, fieldClass, labelClass } from "@/lib/ui";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirm("");
    setMessage("Password updated.");
  }

  return (
    <form
      className="space-y-4 border border-[var(--stroke)] bg-[var(--surface)] p-4"
      onSubmit={onSubmit}
    >
      <label className="block space-y-1.5">
        <span className={labelClass}>New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={fieldClass}
        />
      </label>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className={btnPrimaryClass}>
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
