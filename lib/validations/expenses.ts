import { z } from "zod";

export const expenseSchema = z.object({
  expense_date: z.string().min(1, "Date is required"),
  category_id: z.string().uuid("Select a category"),
  description: z.string().trim().min(1, "Description is required").max(300),
  amount_mmk: z.coerce.number().positive("Amount must be > 0"),
  payment_method: z.enum([
    "cash",
    "bank_transfer",
    "mobile_wallet",
    "card",
    "other",
  ]),
  related_purchase_order_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
