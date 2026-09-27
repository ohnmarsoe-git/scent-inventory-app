export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "staff";
export type ProductType = "EDP" | "EDT" | "OTHER";
export type PoStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";
export type InventoryItemType = "PERFUME_LIQUID" | "DECANT" | "CONSUMABLE";
export type InventoryUnit = "ml" | "each";
export type MovementType =
  | "PURCHASE_RECEIPT"
  | "DECANT_OUT"
  | "DECANT_IN"
  | "SALE"
  | "SALE_RETURN"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "DAMAGE"
  | "SAMPLE"
  | "OTHER";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "mobile_wallet"
  | "card"
  | "other";
export type CostingMethod = "WEIGHTED_AVERAGE";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      app_settings: {
        Row: {
          id: number;
          costing_method: CostingMethod;
          base_currency: string;
          allow_negative_stock: boolean;
          normal_bottle_mmk: Record<string, number> | null;
          price_list_tool_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          costing_method?: CostingMethod;
          base_currency?: string;
          allow_negative_stock?: boolean;
          normal_bottle_mmk?: Record<string, number> | null;
          price_list_tool_ids?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
      };
      brands: {
        Row: {
          id: string;
          name: string;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
      };
      perfumes: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          product_type: ProductType;
          default_bottle_size_ml: number;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          product_type?: ProductType;
          default_bottle_size_ml: number;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["perfumes"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          contact: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          contact?: string | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      consumables: {
        Row: {
          id: string;
          name: string;
          category: string;
          unit: InventoryUnit;
          purchase_price_mmk: number;
          quantity_purchased: number;
          cost_per_unit_mmk: number;
          supplier_id: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          unit?: InventoryUnit;
          purchase_price_mmk?: number;
          quantity_purchased?: number;
          cost_per_unit_mmk?: number;
          supplier_id?: string | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["consumables"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          messenger_contact: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          messenger_contact?: string | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      inventory_items: {
        Row: {
          id: string;
          item_type: InventoryItemType;
          perfume_id: string | null;
          consumable_id: string | null;
          size_ml: number | null;
          unit: InventoryUnit;
          quantity_on_hand: number;
          avg_unit_cost_mmk: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_type: InventoryItemType;
          perfume_id?: string | null;
          consumable_id?: string | null;
          size_ml?: number | null;
          unit: InventoryUnit;
          quantity_on_hand?: number;
          avg_unit_cost_mmk?: number;
          is_active?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["inventory_items"]["Insert"]
        >;
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          sale_date: string;
          customer_id: string | null;
          payment_status: PaymentStatus;
          discount_mmk: number;
          subtotal_mmk: number;
          total_mmk: number;
          paid_amount_mmk: number;
          remaining_amount_mmk: number;
          cogs_mmk: number;
          gross_profit_mmk: number;
          notes: string | null;
          is_voided: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sale_number: string;
          sale_date?: string;
          customer_id?: string | null;
          payment_status?: PaymentStatus;
          discount_mmk?: number;
          subtotal_mmk?: number;
          total_mmk?: number;
          paid_amount_mmk?: number;
          remaining_amount_mmk?: number;
          cogs_mmk?: number;
          gross_profit_mmk?: number;
          notes?: string | null;
          is_voided?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Insert"]>;
      };
      expenses: {
        Row: {
          id: string;
          expense_number: string;
          expense_date: string;
          category_id: string;
          description: string;
          amount_mmk: number;
          payment_method: PaymentMethod;
          related_purchase_order_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_number: string;
          expense_date?: string;
          category_id: string;
          description: string;
          amount_mmk: number;
          payment_method?: PaymentMethod;
          related_purchase_order_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };
    };
    Functions: {
      receive_purchase_order: {
        Args: {
          p_purchase_order_id: string;
          p_lines: Json;
          p_notes?: string | null;
        };
        Returns: string;
      };
      next_doc_number: {
        Args: { p_doc_type: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      product_type: ProductType;
      po_status: PoStatus;
      inventory_item_type: InventoryItemType;
      inventory_unit: InventoryUnit;
      movement_type: MovementType;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      costing_method: CostingMethod;
    };
  };
};
