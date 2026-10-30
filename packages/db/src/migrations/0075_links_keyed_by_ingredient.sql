-- Product Links, Aisle Links and store preferences are keyed by their
-- Ingredient since 0.25 (ADR-0037). A row still keyed by its folded name only
-- (from before 0.25) is parked as it stood, for the boot upgrade to key by food.
CREATE TABLE IF NOT EXISTS "parked_name_keyed_links" ("id" uuid PRIMARY KEY NOT NULL, "kind" text NOT NULL, "link" jsonb NOT NULL);--> statement-breakpoint
INSERT INTO "parked_name_keyed_links" SELECT "id", 'aisle', to_jsonb(l) FROM "aisle_links" l WHERE "ingredient_id" IS NULL AND coalesce("normalized_name", '') <> '';--> statement-breakpoint
INSERT INTO "parked_name_keyed_links" SELECT "id", 'preference', to_jsonb(l) FROM "ingredient_store_preferences" l WHERE "ingredient_id" IS NULL AND coalesce("normalized_name", '') <> '';--> statement-breakpoint
INSERT INTO "parked_name_keyed_links" SELECT "id", 'product', to_jsonb(l) FROM "store_product_links" l WHERE "ingredient_id" IS NULL AND coalesce("normalized_name", '') <> '';--> statement-breakpoint
DELETE FROM "aisle_links" WHERE "ingredient_id" IS NULL;--> statement-breakpoint
DELETE FROM "ingredient_store_preferences" WHERE "ingredient_id" IS NULL;--> statement-breakpoint
DELETE FROM "store_product_links" WHERE "ingredient_id" IS NULL;--> statement-breakpoint
ALTER TABLE "aisle_links" ALTER COLUMN "ingredient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ALTER COLUMN "ingredient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "store_product_links" ALTER COLUMN "ingredient_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "aisle_links" DROP COLUMN "normalized_name";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP COLUMN "normalized_name";--> statement-breakpoint
ALTER TABLE "store_product_links" DROP COLUMN "normalized_name";
