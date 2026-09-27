# Scent Syntax

Perfume inventory, sales, and profit management for a small decant business.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL, Auth, RLS)
- React Hook Form + Zod (forms in later phases)

## Phase 1 (this scaffold)

- Project setup and app shell (desktop sidebar / mobile bottom nav)
- Supabase client wiring + auth (email/password)
- Full MVP database schema + RLS + `receive_purchase_order` RPC
- Dashboard with empty metric placeholders
- Costing method documented in `lib/domain/costing/COSTING.md` (Weighted Average)

## Phase 2 (masters)

- Brands, Perfumes, Consumables under **Inventory**
- Suppliers under **Purchasing**
- Create / edit / archive (no hard delete)
- Search + show archived toggle
- Consumable cost-per-unit auto-calculated from purchase price ÷ quantity

## Phase 3 (purchasing & stock)

- Purchase orders: draft → ordered → partially received / received (or cancelled)
- Receiving via `receive_purchase_order` RPC (adds ml + WAC + movement)
- Stock on hand + stock movements views

**Extra SQL to run in Supabase** (after the initial schema):

`supabase/migrations/20260918120000_phase3_po_helpers.sql`

## Phase 4 (decanting)

- Decant liquid into sized units with automatic COGS (perfume ml × WAC + packaging)
- First use of a consumable seeds stock from master `quantity_purchased`

**Extra SQL to run in Supabase:**

`supabase/migrations/20260918130000_phase4_decant.sql`

## Phase 5 (sales)

- Customers CRUD
- Sales with stock deduction + locked COGS
- Payments separate from sale (partial / full)

**Extra SQL to run in Supabase:**

`supabase/migrations/20260918140000_phase5_sales.sql`

## Phase 6 (expenses & P&L)

- Operating expenses CRUD
- Profit & Loss (Revenue − COGS − Expenses)
- Dashboard live “This month” metrics

**Extra SQL to run in Supabase:**

`supabase/migrations/20260918150000_phase6_expenses.sql`

## Phase 7 (reports & CSV)

- Sales / product profit / expense / inventory / purchase reports
- CSV export for each report (+ P&L)
- CSV import with preview + validation (brands, suppliers, customers, perfumes, expenses, opening perfume liquid)
- Historical sales are not CSV-imported (use Sales UI so stock/COGS stay correct)

**Extra SQL to run in Supabase:**

`supabase/migrations/20260918160000_phase7_import_helpers.sql`

## Price list

- Market sell prices by perfume × size (3 / 5 / 10 / 20 / 30ml) under **Sales → Price list**
- New sales auto-fill unit price from the list (or COGS + 25% if unset); price stays editable

**Extra SQL:**

`supabase/migrations/20260918170000_price_list.sql`

## Phase 8 (PWA & mobile)

- Installable PWA (`app/manifest.ts`, icons, production service worker)
- Offline fallback page (`/offline`)
- Mobile FAB for quick create + More sheet for secondary modules
- Debounced search, larger tap targets, route loading skeleton
- Settings: allow-negative-stock toggle + install guidance
- Unit tests for CSV helpers and period resolution (`npm test`)

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
See `main-prompt.md` for full product requirements and phased delivery.

3. Run the SQL in `supabase/migrations/20260918000000_initial_schema.sql` in the Supabase SQL editor (or via Supabase CLI).
4. Create a user in **Authentication → Users**.
5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Architecture notes

- Perfume master = catalog (not a purchase lot). Cost comes from receipts via WAC.
- Perfume liquid stock is tracked in **ml**; decants are separate unit SKUs.
- Stock changes always create `inventory_movements`.
- Payments are separate from sales.
- Operating expenses are separate from product COGS.

See `main-prompt.md` for full product requirements and phased delivery.
