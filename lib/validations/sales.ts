import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(160),
  phone: z.string().optional().nullable(),
  messenger_contact: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean(),
});

export const saleLineSchema = z.object({
  inventory_item_id: z.string().uuid("Select a stock item"),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  unit_sale_price_mmk: z.coerce.number().min(0, "Price cannot be negative"),
  line_discount_mmk: z.coerce.number().min(0),
});

export const saleOrderLineSchema = z.object({
  perfume_id: z.string().uuid("Select a scent"),
  size_ml: z.coerce.number().positive("Select a size"),
  quantity: z.coerce.number().int("Quantity must be a whole number").positive(),
  unit_sale_price_mmk: z.coerce.number().min(0, "Price cannot be negative"),
  with_cap: z.boolean().optional(),
  cap_extra_mmk: z.coerce.number().min(0).optional(),
});

export const createSaleOrderSchema = z.object({
  customer_id: z.string().optional().nullable(),
  sale_date: z.string().min(1),
  lines: z.array(saleOrderLineSchema).min(1, "Add at least one line"),
  pay_now: z.boolean(),
  payment_method: z.enum([
    "cash",
    "bank_transfer",
    "mobile_wallet",
    "card",
    "other",
  ]),
});

export const createSaleSchema = z.object({
  customer_id: z.string().optional().nullable(),
  sale_date: z.string().min(1, "Sale date is required"),
  discount_mmk: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
  lines: z.array(saleLineSchema).min(1, "Add at least one line"),
  initial_payment_amount: z.coerce.number().min(0),
  initial_payment_method: z.enum([
    "cash",
    "bank_transfer",
    "mobile_wallet",
    "card",
    "other",
  ]),
});

export const recordPaymentSchema = z.object({
  sale_id: z.string().uuid(),
  amount_mmk: z.coerce.number().positive("Amount must be > 0"),
  payment_method: z.enum([
    "cash",
    "bank_transfer",
    "mobile_wallet",
    "card",
    "other",
  ]),
  payment_date: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateSaleOrderInput = z.infer<typeof createSaleOrderSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overpaid: "Overpaid",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  mobile_wallet: "KBZ Pay",
  card: "Card",
  other: "Other",
};
