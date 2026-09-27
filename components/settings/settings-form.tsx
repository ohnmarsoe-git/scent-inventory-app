"use client";

import { useState, useTransition } from "react";

import { updateAppSettings } from "@/lib/actions/settings";
import { btnPrimaryClass } from "@/lib/ui";

type SettingsFormProps = {
  allowNegativeStock: boolean;
};

export function SettingsForm({ allowNegativeStock }: SettingsFormProps) {
  const [checked, setChecked] = useState(allowNegativeStock);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4 border border-[var(--stroke)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await updateAppSettings({
            allow_negative_stock: checked,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setMessage("Settings saved.");
        });
      }}
    >
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>
          <span className="font-medium text-[var(--ink)]">
            Allow negative stock
          </span>
          <span className="mt-1 block text-[var(--muted)]">
            Off by default. Turn on only if you must sell before receiving stock
            is recorded.
          </span>
        </span>
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

      <button type="submit" disabled={pending} className={btnPrimaryClass}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
