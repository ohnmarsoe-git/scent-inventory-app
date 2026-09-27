# Scent Syntax — Perfume Inventory, Sales & Profit Management App

Build a responsive web application for my small perfume decant business, **Scent Syntax**.

The application must help me manage perfume purchases, inventory, decant costs, customer sales, expenses, payments, and accurate profit/loss.

The most important goal is:

> All business transactions must be connected so that I can see accurate stock, COGS, revenue, gross profit, expenses, and net profit without maintaining separate spreadsheets.

---

# 1. Technology Stack

Use the following stack:

- Next.js — latest stable version
- TypeScript
- App Router
- Tailwind CSS
- Supabase
  - PostgreSQL database
  - Authentication
  - Storage if needed
- React Hook Form for forms
- Zod for validation
- Use a suitable table component/library for responsive data tables
- Use a suitable chart library for dashboard reports
- PWA support
- Mobile-first responsive design

Do NOT introduce unnecessary technologies.

Do NOT create a separate backend server unless there is a strong technical reason.

Use Next.js Server Components and Server Actions/API routes appropriately.

Use TypeScript strictly.

Avoid `any` unless absolutely unavoidable.

---



# 2. Application Goals

The application must manage:

1. Perfume Master
2. Supplier
3. Purchase Orders
4. Purchase / Receiving
5. Inventory
6. Decanting
7. Customers
8. Sales
9. Payments
10. Expenses
11. Cost calculation
12. Profit & Loss
13. Dashboard
14. Reports

The application must support both:

### Supplier-side purchasing

I may purchase perfumes in advance for future resale.

This is NOT a customer pre-order.

Use the terminology:

**Purchase Order**

Example:

Burberry Her EDP 100ml × 2 bottles

Status:

- Draft
- Ordered
- Partially Received
- Received
- Cancelled



### Customer-side sales

Customers purchase perfume or decants from my existing stock.

Use:

**Sales Order / Sale**

---



# 3. Important Business Concept

Do not treat the application as a simple CRUD inventory system.

Every important stock change must create a transaction/history record.

For example:

Purchase:

+100ml

Decant:

-10ml perfume liquid
+1 × 10ml decant stock

Sale:

-1 × 10ml decant

This allows stock history and profit calculations to be traced.

Never simply overwrite stock quantities without recording the corresponding inventory movement.

---



# 4. Perfume Master

Create a Perfume Master module.

Fields:

- ID
- Brand
- Perfume Name
- Product Type
  - Eau de Parfum
  - Eau de Toilette
  - Other
- Original Bottle Size
- Purchase Cost
- Purchase Currency
- Exchange Rate
- Purchase Cost in MMK
- Cost per ml
- Supplier
- Purchase Date
- Notes
- Active / Archived

Example:

Brand:
Burberry

Perfume:
Burberry Her EDP

Bottle:
100ml

Purchase Cost:
250,000 MMK

Cost per ml:

250,000 / 100 = 2,500 MMK/ml

---



# 5. Purchase Order

Create a Purchase Order module.

A Purchase Order represents perfume that I buy from suppliers for my business.

Header:

- PO Number
- Supplier
- Order Date
- Expected Arrival Date
- Currency
- Exchange Rate
- Shipping Cost
- Other Purchase Costs
- Total Cost
- Status
- Notes

Lines:

- Perfume
- Bottle Size
- Quantity
- Unit Cost
- Line Total
- Received Quantity
- Remaining Quantity

Statuses:

Draft
Ordered
Partially Received
Received
Cancelled

Do not add received stock to inventory until the goods are actually received.

---



# 6. Receiving

When a Purchase Order is received:

Create an inventory transaction.

Example:

Purchase Order:

Burberry Her 100ml × 2

Received:

2 bottles

Inventory becomes:

+200ml

If only 1 bottle arrives:

Inventory becomes:

+100ml

PO status:

Partially Received

---



# 7. Inventory

Inventory must track actual available stock.

Important:

Perfume liquid and decant products are different inventory concepts.

Example:

Original perfume:

Burberry Her — 100ml

Available liquid:

75ml

Decant stock:

5ml × 3
10ml × 2

Do not assume that every perfume must be converted into decants.

Support both:

### Original bottle sale

Example:

Sell the complete 100ml bottle.

### Decant sale

Example:

Sell 3ml / 5ml / 10ml.

---



# 8. Decanting

Create a Decant Transaction.

Example:

Source:

Burberry Her 100ml bottle

Decant:

10ml × 5

Inventory movement:

-50ml original perfume liquid

Create:

5 × 10ml decant units

The system must calculate the cost of each decant.

Example:

Perfume cost:

2,500 MMK/ml

10ml perfume cost:

25,000 MMK

Add:

Bottle cost
Label cost
Packaging allocation
Other applicable costs

Total COGS:

25,000 + bottle + label + packaging

---



# 9. Packaging / Consumable Costs

Create master records for consumables.

Examples:

- 3ml bottle
- 5ml bottle
- 10ml bottle
- Atomizer
- Cap
- Sticker
- Label
- Box
- Shopping Bag
- Packaging material

Fields:

- Name
- Category
- Unit
- Purchase Price
- Quantity Purchased
- Cost per Unit
- Current Stock
- Supplier
- Notes

Example:

10ml bottle:

Purchase:

100 bottles = 80,000 MMK

Cost per bottle:

800 MMK

When a 10ml decant is sold, the system can include:

Bottle cost = 800 MMK

---



# 10. Customers

Create a simple Customer module.

Fields:

- Customer Name
- Phone
- Messenger / Contact
- Notes
- Total Purchases
- Total Paid
- Outstanding Balance

Customer information should be optional for walk-in / anonymous sales.

---



# 11. Sales

Create a Sales module.

A sale can contain:

- Full-size perfume
- Decant
- Multiple products

Fields:

- Sale Number
- Sale Date
- Customer
- Payment Status
- Payment Method
- Discount
- Total
- Paid Amount
- Remaining Amount
- Notes

Sale line:

- Product
- Product Type
- Size
- Quantity
- Sale Price
- Discount
- COGS
- Profit

---



# 12. Customer Payment

Customer payment must be separated from the sale itself.

Example:

Sale:

30,000 MMK

Customer pays:

15,000 MMK

Outstanding:

15,000 MMK

Record the payment transaction.

Do not consider unpaid amounts as cash received.

---



# 13. Cost Calculation

This is one of the most important parts of the application.

The system must calculate:

### Product Cost

For perfume:

Purchase Cost / Original Bottle Size

Example:

250,000 / 100ml

= 2,500 MMK/ml

For a 5ml decant:

5 × 2,500

= 12,500 MMK

Then add applicable consumable costs.

Example:

Perfume = 12,500
Bottle = 500
Label = 100
Packaging = 300

COGS = 13,400 MMK

Sale Price = 20,000 MMK

Gross Profit = 6,600 MMK

The calculation must be automatic.

Do not hard-code these numbers.

---



# 14. Costing Method

Design the database so that the costing method can be changed later.

Initially use a simple and understandable costing approach.

Prefer:

Weighted Average Cost

or another clearly documented method.

The selected costing method must be documented in the code.

Do not silently mix different costing methods.

---



# 15. Expenses

Create an Expense module.

Expense categories:

- Delivery
- Shipping
- Advertising
- Tools
- Equipment
- Packaging
- Office
- Platform Fee
- Other

Fields:

- Date
- Category
- Description
- Amount
- Payment Method
- Related Purchase if applicable
- Notes

Important distinction:

### Direct Product Cost

Costs directly attributable to products:

- Perfume
- Decant bottle
- Label
- Packaging



### Business Expense

General operating expenses:

- Advertising
- Internet
- Equipment
- General delivery
- Other operating costs

Keep these separate for reporting.

---



# 16. Profit & Loss

The system must calculate:

Revenue

minus

COGS

equals

Gross Profit

Then:

Gross Profit

minus

Operating Expenses

equals

Net Profit

Example:

Sales Revenue:
850,000

COGS:
430,000

Gross Profit:
420,000

Operating Expenses:
95,000

Net Profit:
325,000

---



# 17. Dashboard

Create a mobile-friendly dashboard.

Show:

### This Month

- Total Sales
- Amount Collected
- Outstanding Customer Balance
- COGS
- Gross Profit
- Expenses
- Net Profit



### Inventory

- Total Inventory Value
- Number of Perfumes
- Low Stock
- Pending Purchases
- Stock Value



### Quick Actions

- New Sale
- New Purchase
- Receive Stock
- New Expense
- New Customer
- Decant Stock

---



# 18. Reports

Create reports for:

### Sales Report

Filter:

- Today
- This week
- This month
- Custom date

Show:

- Revenue
- Quantity
- COGS
- Gross Profit



### Product Profit Report

Show each perfume:

- Quantity Sold
- Revenue
- COGS
- Gross Profit



### Expense Report

Show:

- Category
- Amount
- Percentage



### Inventory Report

Show:

- Product
- Available quantity
- Unit cost
- Inventory value



### Purchase Report

Show:

- Purchase amount
- Supplier
- Received amount
- Outstanding purchase orders

---



# 19. Mobile UX

The application must be designed mobile-first.

It must work well on:

- Mobile phone
- Tablet
- Desktop

Do not simply shrink desktop tables.

For mobile:

Use:

- Cards
- Bottom navigation
- Floating action button where appropriate
- Collapsible filters
- Responsive forms
- Large touch targets
- Simple navigation

For desktop/tablet:

Use:

- Sidebar
- Data tables
- Dashboard cards
- Multi-column forms

---



# 20. Navigation

Suggested navigation:

Dashboard

Inventory

- Perfumes
- Decants
- Stock Movements

Purchasing

- Purchase Orders
- Receiving
- Suppliers

Sales

- Sales
- Customers
- Payments

Expenses

Reports

Settings

---



# 21. Authentication

Use Supabase Authentication.

Initially support:

- Email/password login

The application should have user roles prepared for future expansion.

Possible roles:

- Admin
- Staff

Do not over-engineer permissions in the MVP.

---



# 22. Database Requirements

Use PostgreSQL through Supabase.

Design normalized relational tables.

Suggested tables:

- brands
- perfumes
- suppliers
- customers
- consumables
- purchase_orders
- purchase_order_items
- purchase_receipts
- purchase_receipt_items
- inventory_items
- inventory_movements
- decant_transactions
- decant_items
- sales
- sale_items
- payments
- expenses
- expense_categories

Add appropriate:

- Primary keys
- Foreign keys
- Indexes
- Unique constraints
- Created timestamps
- Updated timestamps

Use UUIDs where appropriate.

Do not duplicate data unnecessarily.

---



# 23. Inventory Transaction Rules

Every inventory change must have a reason.

Possible movement types:

- PURCHASE_RECEIPT
- DECANT
- SALE
- SALE_RETURN
- ADJUSTMENT_IN
- ADJUSTMENT_OUT
- DAMAGE
- SAMPLE
- OTHER

Every movement should store:

- Date/time
- Product
- Quantity
- Unit
- Movement type
- Reference transaction
- Cost
- Notes

Inventory balance should be derivable from inventory movements.

---



# 24. Data Integrity

Prevent:

- Selling more stock than available
- Receiving more than ordered without explicit adjustment
- Negative inventory unless explicitly enabled
- Invalid payment amounts
- Invalid sale quantities
- Deleting transactions that already affect financial reports

Prefer:

Archive / cancel instead of hard delete for important transactions.

---



# 25. Currency

Primary business currency:

MMK

But purchase records should support foreign currencies because perfume may be purchased internationally.

Support:

- USD
- MMK
- Other currencies

Store:

Original amount
Currency
Exchange rate
MMK amount

Never overwrite the original purchase currency amount.

---



# 26. UI Design

Brand:

Scent Syntax

Design direction:

- Clean
- Premium
- Minimal
- Modern
- Perfume-business aesthetic

Use a restrained luxury style.

Avoid excessive gradients, animations, and decorative UI.

Prioritize usability over decoration.

---



# 27. Search and Filtering

All major lists should support:

- Search
- Date filter
- Status filter
- Product filter
- Customer filter
- Supplier filter

Search should work well on mobile.

---



# 28. Import Existing Data

The current business data may exist in Excel/Google Sheets.

Prepare the application for CSV/XLSX import.

Initially support import for:

- Brands
- Perfumes
- Suppliers
- Customers
- Existing inventory
- Existing sales
- Expenses

Import must include:

- Preview
- Validation
- Error messages
- Duplicate detection
- Confirmation before inserting

Never import directly without validation.

---



# 29. Backup / Export

Provide export options:

- CSV
- Excel where practical

Allow exporting:

- Sales
- Inventory
- Purchases
- Expenses
- Profit/Loss

Database backup should rely on Supabase capabilities rather than building a complicated custom backup system initially.

---



# 30. Development Approach

Do NOT build the entire application in one huge step.

Build incrementally.

Phase 1:

- Project setup
- Supabase connection
- Authentication
- Database schema
- Layout
- Dashboard shell

Phase 2:

- Brand
- Perfume
- Supplier
- Consumable masters

Phase 3:

- Purchase Order
- Receiving
- Inventory movements

Phase 4:

- Decanting
- Cost calculation

Phase 5:

- Customers
- Sales
- Payments

Phase 6:

- Expenses
- Profit/Loss

Phase 7:

- Reports
- CSV/XLSX import
- Export

Phase 8:

- PWA
- Mobile UX improvements
- Testing
- Performance optimization

---



# 31. Coding Rules

Before writing code:

1. Analyze the requirements.
2. Identify ambiguities.
3. Propose the database schema.
4. Explain the transaction flow.
5. Wait for approval before implementing large architectural changes.

When implementing:

- Keep components reusable.
- Keep business logic separate from UI.
- Use TypeScript types.
- Validate server-side.
- Validate user input.
- Use Supabase Row Level Security.
- Avoid duplicated business logic.
- Avoid unnecessary API calls.
- Handle loading states.
- Handle empty states.
- Handle errors clearly.
- Add confirmation for destructive actions.
- Use transactions/database functions when multiple related records must change atomically.

Do not generate fake data and pretend it is real data.

---



# 32. Critical Requirement

The application must always be able to answer these questions:

1. How much perfume do I currently have?
2. How much money have I invested in inventory?
3. Which perfume is selling?
4. Which perfume is not selling?
5. How much did I sell?
6. How much did I actually collect?
7. How much do customers still owe?
8. How much did the sold products actually cost?
9. How much gross profit did I make?
10. How much operating expense did I have?
11. What is my net profit?
12. How much cash did I spend on purchases?
13. How much inventory value is currently unsold?
14. Which purchases are still pending?
15. What is the profit for each perfume/decant size?

The database and business logic must be designed around these questions.

---



# 33. Important Development Principle

Do not start by designing pretty screens.

Start with:

1. Database schema
2. Inventory transaction model
3. Purchase flow
4. Decant flow
5. Sales flow
6. Cost calculation
7. Profit calculation

Once these are correct, build the UI around them.

Accuracy of inventory and profit is more important than visual design.

---



# First Task

Do NOT build the whole application yet.

First provide:

1. Proposed architecture
2. Complete database ERD
3. PostgreSQL table definitions
4. Relationships
5. Inventory transaction flow
6. Purchase → Receiving → Inventory flow
7. Inventory → Decant → Sale flow
8. Cost calculation formula
9. Profit/Loss calculation formula
10. Recommended Next.js project folder structure
11. Supabase RLS strategy
12. Development phases

Explain any assumptions before implementation.

After I approve the architecture, implement Phase 1 only.