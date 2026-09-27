"use server";

import { revalidatePath } from "next/cache";

import type { ImportEntity } from "@/lib/actions/import-types";
import { actionError } from "@/lib/actions/result";
import { parseCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

export type { ImportEntity } from "@/lib/actions/import-types";

export type ImportRowPreview = {
  index: number;
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  data: Record<string, string>;
};

export type ImportPreviewResult = {
  ok: true;
  entity: ImportEntity;
  rows: ImportRowPreview[];
  validCount: number;
  errorCount: number;
};

export type ImportConfirmResult =
  | { ok: true; inserted: number; skipped: number; errors: string[] }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return supabase;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

export async function previewImport(
  entity: ImportEntity,
  csvText: string,
): Promise<ImportPreviewResult | { ok: false; error: string }> {
  try {
    const supabase = await requireUser();
    const { rows } = parseCsv(csvText);
    if (!rows.length) {
      return { ok: false, error: "CSV has no data rows." };
    }

    const previews: ImportRowPreview[] = [];

    if (entity === "brands") {
      const { data: existing } = await supabase.from("brands").select("name");
      const names = new Set((existing ?? []).map((b) => norm(b.name)));
      rows.forEach((row, index) => {
        const name = row.name?.trim() ?? "";
        if (!name) {
          previews.push({
            index,
            ok: false,
            error: "name is required",
            data: row,
          });
          return;
        }
        const duplicate = names.has(norm(name));
        previews.push({
          index,
          ok: !duplicate,
          duplicate,
          error: duplicate ? "Brand already exists" : undefined,
          data: row,
        });
      });
    } else if (entity === "suppliers") {
      const { data: existing } = await supabase.from("suppliers").select("name");
      const names = new Set((existing ?? []).map((b) => norm(b.name)));
      rows.forEach((row, index) => {
        const name = row.name?.trim() ?? "";
        if (!name) {
          previews.push({
            index,
            ok: false,
            error: "name is required",
            data: row,
          });
          return;
        }
        const duplicate = names.has(norm(name));
        previews.push({
          index,
          ok: !duplicate,
          duplicate,
          error: duplicate ? "Supplier already exists" : undefined,
          data: row,
        });
      });
    } else if (entity === "customers") {
      const { data: existing } = await supabase.from("customers").select("name");
      const names = new Set((existing ?? []).map((b) => norm(b.name)));
      rows.forEach((row, index) => {
        const name = row.name?.trim() ?? "";
        if (!name) {
          previews.push({
            index,
            ok: false,
            error: "name is required",
            data: row,
          });
          return;
        }
        const duplicate = names.has(norm(name));
        previews.push({
          index,
          ok: true,
          duplicate,
          error: duplicate ? "Possible duplicate name (will still import)" : undefined,
          data: row,
        });
      });
    } else if (entity === "perfumes") {
      const [{ data: brands }, { data: perfumes }] = await Promise.all([
        supabase.from("brands").select("id, name"),
        supabase.from("perfumes").select("name, brands(name)"),
      ]);
      const brandByName = new Map(
        (brands ?? []).map((b) => [norm(b.name), b.id as string]),
      );
      const existing = new Set(
        (perfumes ?? []).map((p) => {
          const brand =
            Array.isArray(p.brands)
              ? p.brands[0]?.name
              : (p.brands as { name?: string } | null)?.name;
          return `${norm(brand ?? "")}::${norm(p.name as string)}`;
        }),
      );
      rows.forEach((row, index) => {
        const brand = row.brand?.trim() ?? "";
        const name = row.name?.trim() ?? "";
        const productType = (row.product_type?.trim() || "EDP").toUpperCase();
        const size = Number(row.default_bottle_size_ml);
        if (!brand || !name) {
          previews.push({
            index,
            ok: false,
            error: "brand and name are required",
            data: row,
          });
          return;
        }
        if (!brandByName.has(norm(brand))) {
          previews.push({
            index,
            ok: false,
            error: `Brand not found: ${brand}`,
            data: row,
          });
          return;
        }
        if (!["EDP", "EDT", "OTHER"].includes(productType)) {
          previews.push({
            index,
            ok: false,
            error: "product_type must be EDP, EDT, or OTHER",
            data: row,
          });
          return;
        }
        if (!(size > 0)) {
          previews.push({
            index,
            ok: false,
            error: "default_bottle_size_ml must be > 0",
            data: row,
          });
          return;
        }
        const key = `${norm(brand)}::${norm(name)}`;
        const duplicate = existing.has(key);
        previews.push({
          index,
          ok: !duplicate,
          duplicate,
          error: duplicate ? "Perfume already exists for this brand" : undefined,
          data: { ...row, product_type: productType },
        });
      });
    } else if (entity === "expenses") {
      const { data: categories } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("is_active", true);
      const catByName = new Map(
        (categories ?? []).map((c) => [norm(c.name), c.id as string]),
      );
      const methods = new Set([
        "cash",
        "bank_transfer",
        "mobile_wallet",
        "card",
        "other",
      ]);
      rows.forEach((row, index) => {
        const category = row.category?.trim() ?? "";
        const description = row.description?.trim() ?? "";
        const amount = Number(row.amount_mmk);
        const method = (row.payment_method?.trim() || "cash").toLowerCase();
        const date = row.expense_date?.trim() ?? "";
        if (!date || !category || !description || !(amount > 0)) {
          previews.push({
            index,
            ok: false,
            error: "expense_date, category, description, amount_mmk required",
            data: row,
          });
          return;
        }
        if (!catByName.has(norm(category))) {
          previews.push({
            index,
            ok: false,
            error: `Unknown category: ${category}`,
            data: row,
          });
          return;
        }
        if (!methods.has(method)) {
          previews.push({
            index,
            ok: false,
            error: `Invalid payment_method: ${method}`,
            data: row,
          });
          return;
        }
        previews.push({ index, ok: true, data: { ...row, payment_method: method } });
      });
    } else if (entity === "perfume_liquid") {
      const [{ data: brands }, { data: perfumes }] = await Promise.all([
        supabase.from("brands").select("id, name"),
        supabase.from("perfumes").select("id, name, brand_id, brands(name)"),
      ]);
      const brandByName = new Map(
        (brands ?? []).map((b) => [norm(b.name), b.id as string]),
      );
      const perfumeLookup = new Map<string, string>();
      for (const p of perfumes ?? []) {
        const brandName =
          Array.isArray(p.brands)
            ? p.brands[0]?.name
            : (p.brands as { name?: string } | null)?.name;
        perfumeLookup.set(
          `${norm(brandName ?? "")}::${norm(p.name as string)}`,
          p.id as string,
        );
      }
      rows.forEach((row, index) => {
        const brand = row.brand?.trim() ?? "";
        const perfume = row.perfume?.trim() ?? "";
        const qty = Number(row.quantity_ml);
        const cost = Number(row.unit_cost_mmk);
        if (!brand || !perfume) {
          previews.push({
            index,
            ok: false,
            error: "brand and perfume are required",
            data: row,
          });
          return;
        }
        if (!brandByName.has(norm(brand))) {
          previews.push({
            index,
            ok: false,
            error: `Brand not found: ${brand}`,
            data: row,
          });
          return;
        }
        const key = `${norm(brand)}::${norm(perfume)}`;
        if (!perfumeLookup.has(key)) {
          previews.push({
            index,
            ok: false,
            error: `Perfume not found: ${brand} / ${perfume}`,
            data: row,
          });
          return;
        }
        if (!(qty > 0) || !(cost >= 0)) {
          previews.push({
            index,
            ok: false,
            error: "quantity_ml > 0 and unit_cost_mmk >= 0 required",
            data: row,
          });
          return;
        }
        previews.push({ index, ok: true, data: row });
      });
    }

    const validCount = previews.filter((r) => r.ok).length;
    return {
      ok: true,
      entity,
      rows: previews,
      validCount,
      errorCount: previews.length - validCount,
    };
  } catch (error) {
    const result = actionError(error, "Could not preview import.");
    return { ok: false, error: result.ok ? "Could not preview import." : result.error };
  }
}

export async function confirmImport(
  entity: ImportEntity,
  csvText: string,
): Promise<ImportConfirmResult> {
  try {
    const preview = await previewImport(entity, csvText);
    if (!preview.ok) return { ok: false, error: preview.error };
    if (preview.validCount === 0) {
      return { ok: false, error: "No valid rows to import." };
    }

    const supabase = await requireUser();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    const validRows = preview.rows.filter((r) => r.ok);

    if (entity === "brands") {
      for (const row of validRows) {
        const { error } = await supabase.from("brands").insert({
          name: row.data.name.trim(),
          notes: row.data.notes?.trim() || null,
          is_active: true,
        });
        if (error) {
          errors.push(`Row ${row.index + 2}: ${error.message}`);
          skipped++;
        } else inserted++;
      }
      revalidatePath("/inventory/brands");
    } else if (entity === "suppliers") {
      for (const row of validRows) {
        const { error } = await supabase.from("suppliers").insert({
          name: row.data.name.trim(),
          phone: row.data.phone?.trim() || null,
          contact: row.data.contact?.trim() || null,
          notes: row.data.notes?.trim() || null,
          is_active: true,
        });
        if (error) {
          errors.push(`Row ${row.index + 2}: ${error.message}`);
          skipped++;
        } else inserted++;
      }
      revalidatePath("/purchasing/suppliers");
    } else if (entity === "customers") {
      for (const row of validRows) {
        const { error } = await supabase.from("customers").insert({
          name: row.data.name.trim(),
          phone: row.data.phone?.trim() || null,
          messenger_contact: row.data.messenger_contact?.trim() || null,
          notes: row.data.notes?.trim() || null,
          is_active: true,
        });
        if (error) {
          errors.push(`Row ${row.index + 2}: ${error.message}`);
          skipped++;
        } else inserted++;
      }
      revalidatePath("/sales/customers");
    } else if (entity === "perfumes") {
      const { data: brands } = await supabase.from("brands").select("id, name");
      const brandByName = new Map(
        (brands ?? []).map((b) => [norm(b.name), b.id as string]),
      );
      for (const row of validRows) {
        const brandId = brandByName.get(norm(row.data.brand));
        if (!brandId) {
          skipped++;
          errors.push(`Row ${row.index + 2}: brand missing`);
          continue;
        }
        const { error } = await supabase.from("perfumes").insert({
          brand_id: brandId,
          name: row.data.name.trim(),
          product_type: row.data.product_type || "EDP",
          default_bottle_size_ml: Number(row.data.default_bottle_size_ml),
          notes: row.data.notes?.trim() || null,
          is_active: true,
        });
        if (error) {
          errors.push(`Row ${row.index + 2}: ${error.message}`);
          skipped++;
        } else inserted++;
      }
      revalidatePath("/inventory/perfumes");
    } else if (entity === "expenses") {
      const { data: categories } = await supabase
        .from("expense_categories")
        .select("id, name");
      const catByName = new Map(
        (categories ?? []).map((c) => [norm(c.name), c.id as string]),
      );
      for (const row of validRows) {
        const categoryId = catByName.get(norm(row.data.category));
        if (!categoryId) {
          skipped++;
          errors.push(`Row ${row.index + 2}: category missing`);
          continue;
        }
        const { error } = await supabase.rpc("create_expense", {
          p_expense_date: row.data.expense_date,
          p_category_id: categoryId,
          p_description: row.data.description.trim(),
          p_amount_mmk: Number(row.data.amount_mmk),
          p_payment_method: row.data.payment_method || "cash",
          p_related_purchase_order_id: null,
          p_notes: row.data.notes?.trim() || null,
        });
        if (error) {
          errors.push(`Row ${row.index + 2}: ${error.message}`);
          skipped++;
        } else inserted++;
      }
      revalidatePath("/expenses");
      revalidatePath("/");
    } else if (entity === "perfume_liquid") {
      const { data: perfumes } = await supabase
        .from("perfumes")
        .select("id, name, brands(name)");
      const perfumeLookup = new Map<string, string>();
      for (const p of perfumes ?? []) {
        const brandName =
          Array.isArray(p.brands)
            ? p.brands[0]?.name
            : (p.brands as { name?: string } | null)?.name;
        perfumeLookup.set(
          `${norm(brandName ?? "")}::${norm(p.name as string)}`,
          p.id as string,
        );
      }
      for (const row of validRows) {
        const perfumeId = perfumeLookup.get(
          `${norm(row.data.brand)}::${norm(row.data.perfume)}`,
        );
        if (!perfumeId) {
          skipped++;
          errors.push(`Row ${row.index + 2}: perfume missing`);
          continue;
        }
        const { error } = await supabase.rpc("import_opening_perfume_liquid", {
          p_perfume_id: perfumeId,
          p_quantity_ml: Number(row.data.quantity_ml),
          p_unit_cost_mmk: Number(row.data.unit_cost_mmk),
          p_notes: row.data.notes?.trim() || null,
        });
        if (error) {
          errors.push(`Row ${row.index + 2}: ${error.message}`);
          skipped++;
        } else inserted++;
      }
      revalidatePath("/inventory/stock");
      revalidatePath("/reports/inventory");
      revalidatePath("/");
    }

    preview.rows.filter((r) => !r.ok).forEach(() => skipped++);

    return { ok: true, inserted, skipped, errors };
  } catch (error) {
    const result = actionError(error, "Could not import.");
    return {
      ok: false,
      error: result.ok ? "Could not import." : result.error,
    };
  }
}
