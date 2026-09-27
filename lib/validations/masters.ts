import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v));

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(120),
  notes: optionalText.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(120),
  phone: optionalText.nullable().optional(),
  contact: optionalText.nullable().optional(),
  notes: optionalText.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const perfumeSchema = z.object({
  brand_id: z.string().uuid("Select a brand"),
  name: z.string().trim().min(1, "Perfume name is required").max(160),
  product_type: z.enum(["EDP", "EDT", "OTHER"]),
  default_bottle_size_ml: z.coerce
    .number()
    .positive("Bottle size must be greater than 0"),
  notes: optionalText.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const consumableFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().min(1, "Category is required").max(80),
  unit: z.enum(["ml", "each"]),
  purchase_price_mmk: z.coerce.number().min(0, "Price cannot be negative"),
  quantity_purchased: z.coerce.number().min(0, "Quantity cannot be negative"),
  supplier_id: z.string().optional().nullable(),
  notes: optionalText.nullable().optional(),
  is_active: z.boolean().default(true),
});

export const consumableReceiptSchema = z.object({
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  total_mmk: z.coerce.number().min(0, "Total cannot be negative"),
});

export function normalizeConsumableInput(
  data: z.infer<typeof consumableFormSchema>,
) {
  const supplier_id =
    !data.supplier_id || data.supplier_id === "" ? null : data.supplier_id;
  const cost_per_unit_mmk =
    data.quantity_purchased > 0
      ? data.purchase_price_mmk / data.quantity_purchased
      : 0;

  return {
    name: data.name,
    category: data.category,
    unit: data.unit,
    purchase_price_mmk: data.purchase_price_mmk,
    quantity_purchased: data.quantity_purchased,
    cost_per_unit_mmk,
    supplier_id,
    notes: data.notes ?? null,
    is_active: data.is_active,
  };
}

export type BrandInput = z.infer<typeof brandSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type PerfumeInput = z.infer<typeof perfumeSchema>;
export type ConsumableFormInput = z.infer<typeof consumableFormSchema>;
