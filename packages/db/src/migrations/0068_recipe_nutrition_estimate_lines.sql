-- An estimate is now one share per line, kept in "lines"; the whole-gap
-- columns go, and the rows written in the old shape go with them. The next
-- estimation run writes each recipe's again.
DELETE FROM "recipe_nutrition_estimates";--> statement-breakpoint
ALTER TABLE "recipe_nutrition_estimates" DROP COLUMN "calories";--> statement-breakpoint
ALTER TABLE "recipe_nutrition_estimates" DROP COLUMN "fat";--> statement-breakpoint
ALTER TABLE "recipe_nutrition_estimates" DROP COLUMN "carbs";--> statement-breakpoint
ALTER TABLE "recipe_nutrition_estimates" DROP COLUMN "protein";
