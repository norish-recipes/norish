-- Product Links, Aisle Links and store preferences are keyed by their
-- Ingredient since 0.25 (ADR-0037), whose boots carried every row over. A row
-- still keyed by its old folded name only is one that carry-over could not
-- place, so it goes with the name it was keyed by.
DELETE FROM "aisle_links" WHERE "ingredient_id" IS NULL;--> statement-breakpoint
DELETE FROM "ingredient_store_preferences" WHERE "ingredient_id" IS NULL;--> statement-breakpoint
DELETE FROM "store_product_links" WHERE "ingredient_id" IS NULL;--> statement-breakpoint
ALTER TABLE "aisle_links" ALTER COLUMN "ingredient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ALTER COLUMN "ingredient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "store_product_links" ALTER COLUMN "ingredient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "aisle_links" DROP COLUMN "normalized_name";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP COLUMN "normalized_name";--> statement-breakpoint
ALTER TABLE "store_product_links" DROP COLUMN "normalized_name";
