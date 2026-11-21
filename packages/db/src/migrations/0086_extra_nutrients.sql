ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "nutrition_extras" jsonb;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD COLUMN IF NOT EXISTS "extras" jsonb;--> statement-breakpoint
ALTER TABLE "nutrition_foods" ADD COLUMN IF NOT EXISTS "extras" jsonb;