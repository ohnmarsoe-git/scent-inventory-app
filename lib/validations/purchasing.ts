import { z } from "zod";

export const poLineSchema = z.object({
  perfume_id: z.string().uuid("Select a perfume"),
  bottle_size_ml: z.coerce.number().positive("Bottle size must be > 0"),
  quantity: z.coerce
    .number()
    .int("Qty (bottles) must be a whole number")
    .positive("Quantity must be at least 1"),
  unit_cost_original: z.coerce.number().min(0, "Unit cost cannot be negative"),
  notes: z.string().optional().nullable(),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().uuid("Select a supplier"),
  order_date: z.string().min(1, "Order date is required"),
  expected_arrival_date: z.string().optional().nullable(),
  currency: z.string().trim().min(1, "Currency is required"),
  exchange_rate: z.coerce.number().positive("Exchange rate must be > 0"),
  shipping_cost_original: z.coerce.number().min(0),
  other_cost_original: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
  deposit_paid_mmk: z.coerce.number().min(0, "Paid amount cannot be negative"),
  lines: z.array(poLineSchema).min(1, "Add at least one line"),
});

export const receiveLineSchema = z.object({
  purchase_order_item_id: z.string().uuid(),
  quantity_bottles: z.coerce
    .number()
    .int("Receive qty must be a whole number")
    .positive(),
});

export const receivePurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid(),
  received_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Receiving date is required")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, "Receiving date is invalid"),
  shipping_cost_mmk: z.coerce.number().min(0, "Shipping cannot be negative"),
  other_cost_mmk: z.coerce.number().min(0, "Other costs cannot be negative"),
  notes: z.string().optional().nullable(),
  lines: z
    .array(receiveLineSchema)
    .min(1, "Receive at least one line")
    .refine(
      (lines) => lines.some((l) => l.quantity_bottles > 0),
      "Enter a receive quantity",
    ),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;

export const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};
