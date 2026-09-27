import { z } from "zod";

export const decantConsumableSchema = z.object({
  consumable_id: z.string().uuid("Select a consumable"),
  quantity_per_unit: z.coerce.number().positive("Qty per unit must be > 0"),
});

export const decantOutputSchema = z.object({
  size_ml: z.coerce.number().positive("Size must be > 0"),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
  consumables: z.array(decantConsumableSchema).optional(),
});

export const createDecantSchema = z.object({
  perfume_id: z.string().uuid("Select a perfume with liquid stock"),
  notes: z.string().optional().nullable(),
  outputs: z.array(decantOutputSchema).min(1, "Add at least one decant size"),
});

export type CreateDecantInput = z.infer<typeof createDecantSchema>;

export const COMMON_DECANT_SIZES = [3, 5, 10, 15, 20, 30] as const;
