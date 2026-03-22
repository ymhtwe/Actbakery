Update the Item Management page to use the correct Supabase tables and view.

IMPORTANT:
Do NOT use kv_store or any key-value storage.

Use the following database structure.

Items table:
public.items
Columns:
- id (uuid)
- name (text)
- low_stock_threshold (int4)
- is_active (bool)
- created_at (timestamptz)

Stock view:
public.v_item_stock
Columns:
- item_id
- name
- low_stock_threshold
- total_produced
- total_sold
- current_stock

Requirements:

1. The Item Management table must load data from the view `public.v_item_stock`.

Displayed columns:
- Item Name → name
- Current Stock → current_stock
- Low Stock Threshold → low_stock_threshold
- Status

Status rules:
- If current_stock <= low_stock_threshold → show "Low Stock"
- Otherwise → show "In Stock"

2. Creating a new item must INSERT into `public.items` only.

Fields to insert:
- name
- low_stock_threshold
- is_active = true

Do NOT store stock in the items table.

3. Editing an item must UPDATE `public.items`.

4. Deleting an item must DELETE from `public.items`.

5. The "Low Stock Threshold" field must allow value 0.

Validation rules:
- Minimum value = 0
- No negative numbers.

6. After creating or editing an item, refresh the list by reloading `public.v_item_stock`.

7. The Production Entry page item dropdown must load items from `public.items`
where `is_active = true`.

Display item name but submit the selected `item_id` to the `production_logs` table.