import { z } from "zod";

export const priceListCellSchema = z.object({
  perfume_id: z.string().uuid(),
  size_ml: z.coerce.number().positive(),
  sell_price_mmk: z.coerce.number().min(0),
});

export const upsertPriceListSchema = z.object({
  cells: z.array(priceListCellSchema).min(1),
});

export const priceListCostBasisSchema = z.object({
  tool_ids: z.array(z.string().uuid()),
  bottles: z.object({
    3: z.coerce.number().min(0),
    5: z.coerce.number().min(0),
    10: z.coerce.number().min(0),
    20: z.coerce.number().min(0),
    30: z.coerce.number().min(0),
  }),
});

export type PriceListCellInput = z.infer<typeof priceListCellSchema>;
