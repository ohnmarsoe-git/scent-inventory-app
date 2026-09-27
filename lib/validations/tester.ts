import { z } from "zod";

/** Quick picks; any positive ml (e.g. 2.5 leftover) is also allowed. */
export const TESTER_SIZES = [2, 3] as const;

export const recordTesterSchema = z.object({
  perfume_id: z.string().uuid("Select a scent"),
  size_ml: z.coerce
    .number()
    .positive("Millilitres must be greater than 0")
    .max(5000, "Millilitres is too large"),
  quantity: z.coerce.number().int("Quantity must be a whole number").positive(),
  notes: z.string().trim().max(200).optional().nullable(),
});

export type RecordTesterInput = z.infer<typeof recordTesterSchema>;
