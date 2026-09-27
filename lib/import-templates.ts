import type { ImportEntity } from "@/lib/actions/import-types";

export type { ImportEntity } from "@/lib/actions/import-types";

const TEMPLATES: Record<ImportEntity, string> = {
  brands: "name,notes\nChanel,\nDior,Notes here",
  suppliers: "name,phone,contact,notes\nABC Trading,0912345678,Maung,",
  customers: "name,phone,messenger_contact,notes\nAye Aye,09987654321,@aye,",
  perfumes:
    "brand,name,product_type,default_bottle_size_ml,notes\nChanel,Bleu de Chanel,EDP,100,",
  expenses:
    "expense_date,category,description,amount_mmk,payment_method,notes\n2026-09-01,Advertising,FB ads,50000,cash,",
  perfume_liquid:
    "brand,perfume,quantity_ml,unit_cost_mmk,notes\nChanel,Bleu de Chanel,100,1200,Opening",
};

export function getImportTemplate(entity: ImportEntity) {
  return TEMPLATES[entity];
}
