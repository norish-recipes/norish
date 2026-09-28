ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
DROP INDEX "idx_ingredients_normalized_name";--> statement-breakpoint
DROP INDEX "idx_recipe_ingredients_ingredient_id";--> statement-breakpoint
ALTER TABLE "ingredients" DROP COLUMN "normalized_name";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP COLUMN "ingredient_id";