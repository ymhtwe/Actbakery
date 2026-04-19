-- Add sort_order column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Initialize sort_order based on existing created_at order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM items
)
UPDATE items SET sort_order = ranked.rn
FROM ranked WHERE items.id = ranked.id;
