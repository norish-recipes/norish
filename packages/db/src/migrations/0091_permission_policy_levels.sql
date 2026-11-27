-- The Permission Policy is Everyone or Household (ADR-0041): `owner` becomes `household`, a
-- missing level takes its default, and edit or delete never reach further than view.
WITH levels AS (
  SELECT "id",
    CASE WHEN "value"->>'view' IN ('household', 'owner') THEN 'household' ELSE 'everyone' END AS v,
    CASE WHEN "value"->>'edit' = 'everyone' THEN 'everyone' ELSE 'household' END AS e,
    CASE WHEN "value"->>'delete' = 'everyone' THEN 'everyone' ELSE 'household' END AS d
  FROM "server_config" WHERE "key" = 'recipe_permission_policy' AND "value" IS NOT NULL
)
UPDATE "server_config" c SET "value" = jsonb_build_object(
  'view', l.v,
  'edit', CASE WHEN l.v = 'household' THEN 'household' ELSE l.e END,
  'delete', CASE WHEN l.v = 'household' THEN 'household' ELSE l.d END
)
FROM levels l WHERE c."id" = l."id";--> statement-breakpoint
-- The Ingredient edit policy is gone; a household's own Ingredients are its own (ADR-0042).
DELETE FROM "server_config" WHERE "key" = 'ingredient_permission_policy';
