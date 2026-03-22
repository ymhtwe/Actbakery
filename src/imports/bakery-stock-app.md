Build a simple internal bakery production and stock management web app.

Stack:
- Supabase for authentication and database
- Role-based access (staff, admin)
- Responsive desktop-first layout
- Clean neutral UI with soft gold accent

AUTHENTICATION:
Use Supabase Auth (email/password).
After login:
- If role = "staff" → redirect to /staff
- If role = "admin" → redirect to /admin

DATABASE STRUCTURE:

Table: users
- id (uuid)
- email
- role (staff | admin)

Table: items
- id (uuid)
- name (text)
- low_stock_threshold (integer)
- created_at

Table: production_logs
- id (uuid)
- item_id (fk → items.id)
- quantity (integer)
- created_by (fk → users.id)
- created_at (timestamp)

Table: sales_logs
- id (uuid)
- item_id (fk → items.id)
- quantity (integer)
- created_by (fk → users.id)
- created_at (timestamp)

STOCK CALCULATION:
Current stock = 
SUM(production_logs.quantity) 
- SUM(sales_logs.quantity)

Do NOT store stock directly.
Always calculate dynamically.

--------------------------------

STAFF FEATURES:

Production Entry:
- Select date (default today)
- Select item (dropdown from items table)
- Enter quantity
- Submit → insert into production_logs

Sales Entry:
- Select item
- Show current stock (live calculation)
- Enter quantity
- Validate: quantity <= current stock
- Submit → insert into sales_logs

--------------------------------

ADMIN FEATURES:

Dashboard:
- Show cards for each item:
    - Today Produced
    - Current Stock
    - Status badge:
        if stock <= low_stock_threshold → Low Stock
        if stock <= threshold/2 → Critical
        else → In Stock

- Low stock summary alert
- Daily total production chart
- Top items chart (by total produced)

Reports:
- Date range filter
- Item filter
- Overview mode (all items total)
- By item mode
- Summary statistics:
    - Total produced
    - Average per day
    - Highest day
    - Lowest day
- Daily summary table

Inventory Page:
- Search items
- Filter by status
- Show:
    - Today produced
    - Current stock
    - Status
    - View trend button

Settings Page:
- CRUD for items
- Add Item modal:
    - name
    - low_stock_threshold
- Edit
- Delete (prevent if logs exist)

--------------------------------

SECURITY (RLS):

- Staff can insert production_logs and sales_logs.
- Staff can only view items.
- Admin can view everything.
- Only admin can modify items.

--------------------------------

Keep architecture simple.
No multi-branch.
No warehouse logic.
No customer accounting.
No advanced permissions.
No financial module.
No complex analytics.

This is Phase 1 simple internal bakery system.