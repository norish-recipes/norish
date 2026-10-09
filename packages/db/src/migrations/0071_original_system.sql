ALTER TABLE "recipes" ADD COLUMN "original_system" "measurement_system";--> statement-breakpoint
-- A recipe converted before the column existed holds a copy in each system:
-- the copy written first is the one the recipe was written in.
UPDATE "recipes" SET "original_system" = "first"."system_used"
FROM (
  SELECT DISTINCT ON ("recipe_id") "recipe_id", "system_used"
  FROM "recipe_ingredients"
  ORDER BY "recipe_id", "created_at", "order"
) AS "first"
WHERE "first"."recipe_id" = "recipes"."id"
  AND EXISTS (
    SELECT 1 FROM "recipe_ingredients" AS "other"
    WHERE "other"."recipe_id" = "recipes"."id"
      AND "other"."system_used" <> "first"."system_used"
  );
