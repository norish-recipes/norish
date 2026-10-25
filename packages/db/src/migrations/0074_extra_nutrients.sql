ALTER TABLE "recipes" ADD COLUMN "nutrition_extras" jsonb;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD COLUMN "extras" jsonb;--> statement-breakpoint
ALTER TABLE "nutrition_foods" ADD COLUMN "extras" jsonb;