"use client";

import { useMemo, useState, useTransition } from "react";

import {
  confirmImport,
  previewImport,
  type ImportPreviewResult,
} from "@/lib/actions/import";
import type { ImportEntity } from "@/lib/actions/import-types";
import { getImportTemplate } from "@/lib/import-templates";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  labelClass,
} from "@/lib/ui";

const ENTITIES: Array<{ value: ImportEntity; label: string; hint: string }> = [
  {
    value: "brands",
    label: "Brands",
    hint: "Columns: name, notes",
  },
  {
    value: "suppliers",
    label: "Suppliers",
    hint: "Columns: name, phone, contact, notes",
  },
  {
    value: "customers",
    label: "Customers",
    hint: "Columns: name, phone, messenger_contact, notes",
  },
  {
    value: "perfumes",
    label: "Perfumes",
    hint: "Columns: brand, name, product_type, default_bottle_size_ml, notes",
  },
  {
    value: "expenses",
    label: "Expenses",
    hint: "Columns: expense_date, category, description, amount_mmk, payment_method, notes",
  },
  {
    value: "perfume_liquid",
    label: "Opening perfume liquid",
    hint: "Columns: brand, perfume, quantity_ml, unit_cost_mmk, notes — adds ml via WAC",
  },
];

export function ImportWizard() {
  const [entity, setEntity] = useState<ImportEntity>("brands");
  const [csvText, setCsvText] = useState(getImportTemplate("brands"));
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const entityMeta = useMemo(
    () => ENTITIES.find((e) => e.value === entity)!,
    [entity],
  );

  function onEntityChange(next: ImportEntity) {
    setEntity(next);
    setCsvText(getImportTemplate(next));
    setPreview(null);
    setMessage(null);
    setError(null);
  }

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setPreview(null);
      setMessage(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  function runPreview() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await previewImport(entity, csvText);
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  function runConfirm() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await confirmImport(entity, csvText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Imported ${result.inserted} row(s). Skipped ${result.skipped}.` +
          (result.errors.length
            ? ` Issues: ${result.errors.slice(0, 3).join("; ")}`
            : ""),
      );
      setPreview(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className={labelClass}>Import type</span>
          <select
            className={fieldClass}
            value={entity}
            onChange={(e) => onEntityChange(e.target.value as ImportEntity)}
          >
            {ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-[var(--muted)]">{entityMeta.hint}</p>
        <p className="text-sm text-[var(--muted)]">
          Historical sales are not imported via CSV — create them in Sales so
          stock and COGS stay correct. Excel/Sheets: export as CSV (UTF-8).
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Upload CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>CSV contents</span>
        <textarea
          className={`${fieldClass} min-h-40 font-mono text-xs`}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setPreview(null);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={btnSecondaryClass}
          disabled={pending}
          onClick={runPreview}
        >
          {pending ? "Working…" : "Preview & validate"}
        </button>
        <button
          type="button"
          className={btnPrimaryClass}
          disabled={pending || !preview || preview.validCount === 0}
          onClick={runConfirm}
        >
          Confirm import ({preview?.validCount ?? 0})
        </button>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[var(--ink)]" role="status">
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            {preview.validCount} valid · {preview.errorCount} invalid
          </p>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {preview.rows.map((row) => (
              <div
                key={row.index}
                className={`border px-3 py-2 text-xs ${
                  row.ok
                    ? "border-[var(--stroke)] bg-[var(--surface)]"
                    : "border-[var(--danger)]/40 bg-[var(--surface)]"
                }`}
              >
                <p className="font-medium">
                  Row {row.index + 2}{" "}
                  {row.ok ? (
                    <span className="text-[var(--muted)]">OK</span>
                  ) : (
                    <span className="text-[var(--danger)]">{row.error}</span>
                  )}
                  {row.duplicate && row.ok ? (
                    <span className="text-[var(--muted)]"> · note</span>
                  ) : null}
                </p>
                <p className="mt-1 truncate text-[var(--muted)]">
                  {Object.entries(row.data)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
