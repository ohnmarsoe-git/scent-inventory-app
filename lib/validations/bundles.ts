import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v));

export const bundleSetItemSchema = z.object({
  perfume_id: z.string().uuid("Select a perfume"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
});

export const bundleSetSchema = z.object({
  name: z.string().trim().min(1, "Bundle name is required").max(160),
  size_ml: z.coerce.number().positive("Size must be greater than 0"),
  sale_price_mmk: z.coerce.number().min(0, "Price cannot be negative"),
  notes: optionalText.nullable().optional(),
  is_active: z.boolean().default(true),
  items: z
    .array(bundleSetItemSchema)
    .min(1, "Add at least one perfume to the set"),
});

export type BundleSetInput = z.infer<typeof bundleSetSchema>;
export type BundleSetItemInput = z.infer<typeof bundleSetItemSchema>;
