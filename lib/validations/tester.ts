import { z } from "zod";

export const TESTER_SIZES = [2, 3] as const;

export const recordTesterSchema = z.object({
  perfume_id: z.string().uuid("Select a scent"),
  size_ml: z.coerce.number().positive("Size must be greater than 0"),
  quantity: z.coerce.number().int("Quantity must be a whole number").positive(),
  notes: z.string().trim().max(200).optional().nullable(),
});

export type RecordTesterInput = z.infer<typeof recordTesterSchema>;
