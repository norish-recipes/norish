ALTER TABLE "groceries" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_groceries_sort_order" ON "groceries" USING btree ("sort_order");--> statement-breakpoint
-- Backfill sortOrder for existing groceries: assign sequential order per store and user
-- Active items first (ordered by created_at), then done items
WITH ordered_groceries AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, COALESCE(store_id::text, 'null')
      ORDER BY 
        CASE WHEN is_done THEN 1 ELSE 0 END,
        created_at ASC
    ) - 1 AS new_sort_order
  FROM groceries
)
UPDATE groceries
SET sort_order = ordered_groceries.new_sort_order
FROM ordered_groceries
WHERE groceries.id = ordered_groceries.id;