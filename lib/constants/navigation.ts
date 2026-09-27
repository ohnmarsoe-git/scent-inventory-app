export type NavItem = {
  href: string;
  label: string;
  group?: string;
};

export const primaryNav: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/inventory/stock", label: "Stock", group: "Inventory" },
  { href: "/inventory/decants", label: "Decant history", group: "Inventory" },
  { href: "/inventory/testers", label: "Testers", group: "Inventory" },
  { href: "/inventory/movements", label: "Movements", group: "Inventory" },
  { href: "/inventory/brands", label: "Brands", group: "Inventory" },
  { href: "/inventory/perfumes", label: "Perfumes", group: "Inventory" },
  { href: "/inventory/consumables", label: "Consumables", group: "Inventory" },
  { href: "/purchasing", label: "Purchasing" },
  { href: "/purchasing/orders", label: "Purchase orders", group: "Purchasing" },
  { href: "/purchasing/receiving", label: "Receiving", group: "Purchasing" },
  { href: "/purchasing/suppliers", label: "Suppliers", group: "Purchasing" },
  { href: "/sales", label: "Sales" },
  { href: "/sales/orders", label: "Orders", group: "Sales" },
  { href: "/sales/price-list", label: "Price list", group: "Sales" },
  { href: "/sales/customers", label: "Customers", group: "Sales" },
  { href: "/sales/payments", label: "Payments", group: "Sales" },
  { href: "/expenses", label: "Expenses" },
  { href: "/expenses/pnl", label: "Profit & Loss", group: "Expenses" },
  { href: "/reports", label: "Reports" },
  { href: "/reports/sales", label: "Sales report", group: "Reports" },
  { href: "/reports/products", label: "Product profit", group: "Reports" },
  { href: "/reports/expenses", label: "Expense report", group: "Reports" },
  { href: "/reports/inventory", label: "Inventory report", group: "Reports" },
  { href: "/reports/purchases", label: "Purchase report", group: "Reports" },
  { href: "/reports/import", label: "Import CSV", group: "Reports" },
  { href: "/settings", label: "Settings" },
];

export const mobileNav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/inventory/stock", label: "Stock" },
  { href: "/sales/orders", label: "Sales" },
  { href: "/purchasing/orders", label: "Buy" },
];

export const quickActions = [
  { href: "/sales/orders/new", label: "New Sale" },
  { href: "/purchasing/receiving", label: "Receive Stock" },
  { href: "/expenses/new", label: "New Expense" },
  { href: "/sales/price-list", label: "Price list" },
] as const;
