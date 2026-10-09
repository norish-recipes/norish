ALTER TABLE "aisle_links" DROP CONSTRAINT "uq_aisle_links_store_name";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP CONSTRAINT "uq_ingredient_store_prefs_user_name";--> statement-breakpoint
ALTER TABLE "store_product_links" DROP CONSTRAINT "uq_store_product_links_store_name";--> statement-breakpoint
ALTER TABLE "aisle_links" ALTER COLUMN "normalized_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ALTER COLUMN "normalized_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "store_product_links" ALTER COLUMN "normalized_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "aisle_links" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
ALTER TABLE "groceries" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
ALTER TABLE "store_product_links" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
ALTER TABLE "aisle_links" ADD CONSTRAINT "aisle_links_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "ingredient_store_preferences_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_links" ADD CONSTRAINT "store_product_links_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_groceries_ingredient_id" ON "groceries" USING btree ("ingredient_id");--> statement-breakpoint
ALTER TABLE "aisle_links" ADD CONSTRAINT "uq_aisle_links_store_ingredient" UNIQUE("store_id","ingredient_id");--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "uq_ingredient_store_prefs_user_ingredient" UNIQUE("user_id","ingredient_id");--> statement-breakpoint
ALTER TABLE "store_product_links" ADD CONSTRAINT "uq_store_product_links_store_ingredient" UNIQUE("store_id","ingredient_id");--> statement-breakpoint
-- A grocery or recurring grocery already resolved keeps its alias's Ingredient beside it.
UPDATE "groceries" SET "ingredient_id" = "ingredient_aliases"."ingredient_id"
FROM "ingredient_aliases" WHERE "ingredient_aliases"."id" = "groceries"."ingredient_alias_id";--> statement-breakpoint
UPDATE "recurring_groceries" SET "ingredient_id" = "ingredient_aliases"."ingredient_id"
FROM "ingredient_aliases" WHERE "ingredient_aliases"."id" = "recurring_groceries"."ingredient_alias_id";
