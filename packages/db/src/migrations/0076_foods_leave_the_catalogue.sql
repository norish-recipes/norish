-- Deleting an Ingredient or a spelling something uses is no longer refused
-- (ADR-0037): recipe lines and Groceries keep their text and point at no food,
-- and a Pantry Ingredient, which holds only foods, goes. unused_since is set
-- and cleared by the nightly sweep that deletes own foods unused for 90 days.
ALTER TABLE "groceries" DROP CONSTRAINT "groceries_ingredient_alias_id_ingredient_aliases_id_fk";
--> statement-breakpoint
ALTER TABLE "groceries" DROP CONSTRAINT "groceries_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_ingredient_alias_id_ingredient_aliases_id_fk";
--> statement-breakpoint
ALTER TABLE "recurring_groceries" DROP CONSTRAINT "recurring_groceries_ingredient_alias_id_ingredient_aliases_id_fk";
--> statement-breakpoint
ALTER TABLE "recurring_groceries" DROP CONSTRAINT "recurring_groceries_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "pantry_ingredients" DROP CONSTRAINT "pantry_ingredients_ingredient_alias_id_ingredient_aliases_id_fk";
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "unused_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "pantry_ingredients_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE cascade ON UPDATE no action;