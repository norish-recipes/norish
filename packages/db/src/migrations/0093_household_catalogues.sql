-- Each household has its own catalogue on the shared seed (ADR-0042): household_id null is the seed.
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "added_by_hand" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_aliases" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_junk_pile" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_ai_changes" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
DROP INDEX IF EXISTS "uqidx_ingredients_name_lower";--> statement-breakpoint
DROP INDEX IF EXISTS "uqidx_ingredient_aliases_fold";--> statement-breakpoint
DROP INDEX IF EXISTS "uqidx_ingredient_junk_pile_fold";--> statement-breakpoint
ALTER TABLE "ingredients" DROP CONSTRAINT IF EXISTS "ingredients_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_aliases" DROP CONSTRAINT IF EXISTS "ingredient_aliases_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_junk_pile" DROP CONSTRAINT IF EXISTS "ingredient_junk_pile_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_junk_pile" ADD CONSTRAINT "ingredient_junk_pile_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_ai_changes" DROP CONSTRAINT IF EXISTS "ingredient_ai_changes_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_ai_changes" ADD CONSTRAINT "ingredient_ai_changes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- The household an orphan goes to (ticket 03): the server owner's, else the longest-standing admin's, else account's.
CREATE OR REPLACE FUNCTION "pg_temp"."catalogue_heir"() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT hu."household_id" FROM "user" u JOIN "household_users" hu ON hu."user_id" = u."id"
  ORDER BY u."isServerOwner" DESC, u."isServerAdmin" DESC, u."createdAt", u."id" LIMIT 1
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "pg_temp"."member_household"(member text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT "household_id" FROM "household_users" WHERE "user_id" = member
$$;--> statement-breakpoint
-- A seeded food is every household's, so it keeps only a seeded parent.
UPDATE "ingredients" i SET "parent_id" = NULL FROM "ingredients" p
WHERE p."id" = i."parent_id" AND i."off_id" IS NOT NULL AND p."off_id" IS NULL;--> statement-breakpoint
-- An own food is its minter's household's; one whose minter is gone, the heir's.
UPDATE "ingredients" SET "household_id" = coalesce(pg_temp.member_household("owner_id"), pg_temp.catalogue_heir())
WHERE "household_id" IS NULL AND "off_id" IS NULL;--> statement-breakpoint
-- Only a server without a single account is left with own foods no household can hold.
DELETE FROM "ingredients" WHERE "household_id" IS NULL AND "off_id" IS NULL;--> statement-breakpoint
-- A spelling is its food's household's; a person's on a seeded food, its adder's household's (else the heir's).
UPDATE "ingredient_aliases" a SET "household_id" = i."household_id", "seeded" = false FROM "ingredients" i
WHERE i."id" = a."ingredient_id" AND a."household_id" IS NULL AND i."household_id" IS NOT NULL;--> statement-breakpoint
UPDATE "ingredient_aliases" a SET "household_id" = coalesce(pg_temp.member_household(a."owner_id"), pg_temp.catalogue_heir())
FROM "ingredients" i
WHERE i."id" = a."ingredient_id" AND a."household_id" IS NULL AND i."household_id" IS NULL AND NOT a."seeded";--> statement-breakpoint
DELETE FROM "ingredient_aliases" a USING "ingredients" i
WHERE i."id" = a."ingredient_id" AND a."household_id" IS NULL AND i."household_id" IS NULL AND NOT a."seeded";--> statement-breakpoint
-- What each household's rows name: its recipes' lines, lists, Pantry, corrections, preferences and its Stores' links.
CREATE TABLE IF NOT EXISTS "_catalogue_spellings_used" ("alias_id" uuid NOT NULL, "household_id" uuid NOT NULL, PRIMARY KEY ("alias_id", "household_id"));--> statement-breakpoint
INSERT INTO "_catalogue_spellings_used"
SELECT f."ingredient_alias_id", r."household_id" FROM "recipe_ingredient_foods" f
JOIN "recipe_ingredients" ri ON ri."id" = f."recipe_ingredient_id" JOIN "recipes" r ON r."id" = ri."recipe_id"
UNION SELECT "ingredient_alias_id", "household_id" FROM "groceries" WHERE "ingredient_alias_id" IS NOT NULL
UNION SELECT "ingredient_alias_id", "household_id" FROM "recurring_groceries" WHERE "ingredient_alias_id" IS NOT NULL
UNION SELECT "ingredient_alias_id", "household_id" FROM "pantry_ingredients" WHERE "ingredient_alias_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Every own food a household names, and the own parents above it, which its copy is filed under.
CREATE TABLE IF NOT EXISTS "_catalogue_food_copies" ("ingredient_id" uuid NOT NULL, "household_id" uuid NOT NULL, "copy_id" uuid DEFAULT gen_random_uuid() NOT NULL, PRIMARY KEY ("ingredient_id", "household_id"));--> statement-breakpoint
INSERT INTO "_catalogue_food_copies" ("ingredient_id", "household_id")
WITH RECURSIVE "named" ("ingredient_id", "household_id") AS (
  SELECT a."ingredient_id", u."household_id" FROM "_catalogue_spellings_used" u JOIN "ingredient_aliases" a ON a."id" = u."alias_id"
  UNION SELECT "ingredient_id", "household_id" FROM "groceries" WHERE "ingredient_id" IS NOT NULL
  UNION SELECT "ingredient_id", "household_id" FROM "recurring_groceries" WHERE "ingredient_id" IS NOT NULL
  UNION SELECT "ingredient_id", "household_id" FROM "pantry_ingredients"
  UNION SELECT "ingredient_id", "household_id" FROM "ingredient_nutrition_corrections"
  UNION SELECT "ingredient_id", "household_id" FROM "ingredient_store_preferences"
  UNION SELECT l."ingredient_id", s."household_id" FROM "aisle_links" l JOIN "stores" s ON s."id" = l."store_id"
  UNION SELECT l."ingredient_id", s."household_id" FROM "store_product_links" l JOIN "stores" s ON s."id" = l."store_id"
  UNION SELECT "id", "household_id" FROM "ingredients" WHERE "household_id" IS NOT NULL
  UNION SELECT c."parent_id", n."household_id" FROM "named" n JOIN "ingredients" c ON c."id" = n."ingredient_id"
  WHERE c."parent_id" IS NOT NULL
)
SELECT n."ingredient_id", n."household_id" FROM "named" n JOIN "ingredients" i ON i."id" = n."ingredient_id"
WHERE i."household_id" IS NOT NULL AND i."household_id" <> n."household_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- A copy's spellings: those its household's rows use, else the original's oldest; a seeded food's,
-- each household's own copy of a person's spelling its rows use.
CREATE TABLE IF NOT EXISTS "_catalogue_spelling_copies" ("alias_id" uuid NOT NULL, "household_id" uuid NOT NULL, "copy_id" uuid DEFAULT gen_random_uuid() NOT NULL, "ingredient_id" uuid NOT NULL, PRIMARY KEY ("alias_id", "household_id"));--> statement-breakpoint
INSERT INTO "_catalogue_spelling_copies" ("alias_id", "household_id", "ingredient_id")
SELECT a."id", u."household_id", coalesce(c."copy_id", a."ingredient_id")
FROM "_catalogue_spellings_used" u JOIN "ingredient_aliases" a ON a."id" = u."alias_id"
LEFT JOIN "_catalogue_food_copies" c ON c."ingredient_id" = a."ingredient_id" AND c."household_id" = u."household_id"
WHERE a."household_id" IS NOT NULL AND a."household_id" <> u."household_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "_catalogue_spelling_copies" ("alias_id", "household_id", "ingredient_id")
SELECT DISTINCT ON (c."copy_id") a."id", c."household_id", c."copy_id"
FROM "_catalogue_food_copies" c JOIN "ingredient_aliases" a ON a."ingredient_id" = c."ingredient_id"
WHERE NOT EXISTS (SELECT 1 FROM "_catalogue_spelling_copies" s WHERE s."ingredient_id" = c."copy_id")
ORDER BY c."copy_id", a."created_at", a."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- The copies: what the original says, no one of the household as their adder, filed below.
INSERT INTO "ingredients" ("id", "household_id", "name", "owner_id", "added_by_hand", "flagged", "flag_reason", "kept_distinct", "parent_chosen", "icon", "name_settled", "name_chosen", "created_at")
SELECT c."copy_id", c."household_id", i."name", NULL, i."added_by_hand", i."flagged", i."flag_reason", i."kept_distinct", i."parent_chosen", i."icon", i."name_settled", i."name_chosen", i."created_at"
FROM "_catalogue_food_copies" c JOIN "ingredients" i ON i."id" = c."ingredient_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "ingredient_aliases" ("id", "household_id", "text", "fold", "locale", "ingredient_id", "owner_id", "seeded", "created_at", "updated_at")
SELECT c."copy_id", c."household_id", a."text", a."fold", a."locale", c."ingredient_id",
  CASE WHEN pg_temp.member_household(a."owner_id") = c."household_id" THEN a."owner_id" END, false, a."created_at", a."updated_at"
FROM "_catalogue_spelling_copies" c JOIN "ingredient_aliases" a ON a."id" = c."alias_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- A food's parent in its own household: the seeded one, its household's, or that household's copy of it.
UPDATE "ingredients" x SET "parent_id" = coalesce(pc."copy_id", p."id") FROM "_catalogue_food_copies" c
JOIN "ingredients" o ON o."id" = c."ingredient_id" JOIN "ingredients" p ON p."id" = o."parent_id"
LEFT JOIN "_catalogue_food_copies" pc ON pc."ingredient_id" = p."id" AND pc."household_id" = c."household_id"
WHERE x."id" = c."copy_id";--> statement-breakpoint
UPDATE "ingredients" i SET "parent_id" = pc."copy_id" FROM "ingredients" p, "_catalogue_food_copies" pc
WHERE p."id" = i."parent_id" AND pc."ingredient_id" = p."id" AND pc."household_id" = i."household_id"
  AND i."household_id" IS NOT NULL AND p."household_id" <> i."household_id";--> statement-breakpoint
-- Every row of a household names that household's copy.
UPDATE "recipe_ingredient_foods" f SET "ingredient_alias_id" = c."copy_id"
FROM "recipe_ingredients" ri, "recipes" r, "_catalogue_spelling_copies" c
WHERE ri."id" = f."recipe_ingredient_id" AND r."id" = ri."recipe_id"
  AND c."alias_id" = f."ingredient_alias_id" AND c."household_id" = r."household_id";--> statement-breakpoint
UPDATE "groceries" t SET "ingredient_alias_id" = c."copy_id" FROM "_catalogue_spelling_copies" c
WHERE c."alias_id" = t."ingredient_alias_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "groceries" t SET "ingredient_id" = c."copy_id" FROM "_catalogue_food_copies" c
WHERE c."ingredient_id" = t."ingredient_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "recurring_groceries" t SET "ingredient_alias_id" = c."copy_id" FROM "_catalogue_spelling_copies" c
WHERE c."alias_id" = t."ingredient_alias_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "recurring_groceries" t SET "ingredient_id" = c."copy_id" FROM "_catalogue_food_copies" c
WHERE c."ingredient_id" = t."ingredient_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "pantry_ingredients" t SET "ingredient_alias_id" = c."copy_id" FROM "_catalogue_spelling_copies" c
WHERE c."alias_id" = t."ingredient_alias_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "pantry_ingredients" t SET "ingredient_id" = c."copy_id" FROM "_catalogue_food_copies" c
WHERE c."ingredient_id" = t."ingredient_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "ingredient_nutrition_corrections" t SET "ingredient_id" = c."copy_id" FROM "_catalogue_food_copies" c
WHERE c."ingredient_id" = t."ingredient_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "ingredient_store_preferences" t SET "ingredient_id" = c."copy_id" FROM "_catalogue_food_copies" c
WHERE c."ingredient_id" = t."ingredient_id" AND c."household_id" = t."household_id";--> statement-breakpoint
UPDATE "aisle_links" t SET "ingredient_id" = c."copy_id" FROM "stores" s, "_catalogue_food_copies" c
WHERE s."id" = t."store_id" AND c."ingredient_id" = t."ingredient_id" AND c."household_id" = s."household_id";--> statement-breakpoint
UPDATE "store_product_links" t SET "ingredient_id" = c."copy_id" FROM "stores" s, "_catalogue_food_copies" c
WHERE s."id" = t."store_id" AND c."ingredient_id" = t."ingredient_id" AND c."household_id" = s."household_id";--> statement-breakpoint
INSERT INTO "ingredient_nutrition_estimates" ("ingredient_id", "kcal", "fat", "carbs", "protein", "piece_weight", "pieceless", "density", "created_at", "updated_at")
SELECT c."copy_id", e."kcal", e."fat", e."carbs", e."protein", e."piece_weight", e."pieceless", e."density", e."created_at", e."updated_at"
FROM "_catalogue_food_copies" c JOIN "ingredient_nutrition_estimates" e ON e."ingredient_id" = c."ingredient_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- An AI Change is listed to the household whose catalogue it changed: its food's, else the member's it names.
UPDATE "ingredient_ai_changes" c SET "household_id" = i."household_id" FROM "ingredients" i
WHERE i."id" = c."ingredient_id" AND c."household_id" IS NULL AND i."household_id" IS NOT NULL;--> statement-breakpoint
UPDATE "ingredient_ai_changes" SET "household_id" = coalesce(pg_temp.member_household(coalesce(
  "undo" ->> 'ownerId', "undo" -> 'food' ->> 'ownerId', "undo" -> 'spelling' ->> 'ownerId')), pg_temp.catalogue_heir())
WHERE "household_id" IS NULL;--> statement-breakpoint
DELETE FROM "ingredient_ai_changes" WHERE "household_id" IS NULL;--> statement-breakpoint
-- A copy carries every change on its food; below, its ids become its household's.
INSERT INTO "ingredient_ai_changes" ("kind", "household_id", "ingredient_id", "target_id", "sure", "undo", "created_at", "kept_at", "undone_at")
SELECT ch."kind", c."household_id", c."copy_id", ch."target_id", ch."sure",
  CASE WHEN ch."kind" = 'merge' THEN jsonb_set(ch."undo", '{ownerId}', 'null'::jsonb) ELSE ch."undo" END,
  ch."created_at", ch."kept_at", ch."undone_at"
FROM "ingredient_ai_changes" ch JOIN "_catalogue_food_copies" c ON c."ingredient_id" = ch."ingredient_id";--> statement-breakpoint
-- A food, spelling or row a change names, in the change's household: the id where it is that household's,
-- the seed's or gone; that household's copy of it; else null (another household's, no copy there).
CREATE OR REPLACE FUNCTION "pg_temp"."food_in"(uuid, uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN i."id" IS NULL OR i."household_id" IS NULL OR i."household_id" = $2 THEN $1 ELSE c."copy_id" END
  FROM (SELECT $1 AS "id") w LEFT JOIN "ingredients" i ON i."id" = w."id"
  LEFT JOIN "_catalogue_food_copies" c ON c."ingredient_id" = i."id" AND c."household_id" = $2
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "pg_temp"."spelling_in"(uuid, uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN a."id" IS NULL OR a."household_id" IS NULL OR a."household_id" = $2 THEN $1 ELSE c."copy_id" END
  FROM (SELECT $1 AS "id") w LEFT JOIN "ingredient_aliases" a ON a."id" = w."id"
  LEFT JOIN "_catalogue_spelling_copies" c ON c."alias_id" = a."id" AND c."household_id" = $2
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "pg_temp"."row_in"(uuid, uuid) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN coalesce(r."household_id", g."household_id", rg."household_id") IS NULL
    OR coalesce(r."household_id", g."household_id", rg."household_id") = $2 THEN $1 END
  FROM (SELECT $1 AS "id") w
  LEFT JOIN "recipe_ingredients" ri ON ri."id" = w."id" LEFT JOIN "recipes" r ON r."id" = ri."recipe_id"
  LEFT JOIN "groceries" g ON g."id" = w."id" LEFT JOIN "recurring_groceries" rg ON rg."id" = w."id"
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "pg_temp"."ids_in"(jsonb, uuid, text) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(y) ORDER BY n) FILTER (WHERE y IS NOT NULL), '[]'::jsonb)
  FROM jsonb_array_elements_text(coalesce($1, '[]'::jsonb)) WITH ORDINALITY AS t(x, n),
  LATERAL (SELECT CASE $3 WHEN 'spelling' THEN pg_temp.spelling_in(x::uuid, $2) ELSE pg_temp.row_in(x::uuid, $2) END) AS m(y)
$$;--> statement-breakpoint
-- A list's objects made the household's: the row under key $3 its own, the spelling under key $4 its own or
-- its copy; an object naming another household's row or spelling is left out.
CREATE OR REPLACE FUNCTION "pg_temp"."rows_in"(jsonb, uuid, text, text DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(CASE WHEN m."s" IS NULL THEN e ELSE e || jsonb_build_object($4, m."s") END ORDER BY n), '[]'::jsonb)
  FROM jsonb_array_elements(coalesce($1, '[]'::jsonb)) WITH ORDINALITY AS t(e, n),
  LATERAL (SELECT pg_temp.spelling_in((e ->> $4)::uuid, $2) AS "s") m
  WHERE ($3 IS NULL OR pg_temp.row_in((e ->> $3)::uuid, $2) IS NOT NULL) AND ((e ->> $4) IS NULL OR m."s" IS NOT NULL)
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "pg_temp"."undo_in"(jsonb, uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT CASE $1 ->> 'kind'
    WHEN 'merge' THEN $1 || jsonb_build_object('aliasIds', pg_temp.ids_in($1 -> 'aliasIds', $2, 'spelling'),
      'parentId', pg_temp.food_in(($1 ->> 'parentId')::uuid, $2))
    WHEN 'parent' THEN $1 || jsonb_build_object('formerParentId', pg_temp.food_in(($1 ->> 'formerParentId')::uuid, $2))
    WHEN 'not-a-food' THEN jsonb_set($1, '{food}', ($1 -> 'food') || jsonb_build_object(
      'ingredientId', pg_temp.food_in(($1 -> 'food' ->> 'ingredientId')::uuid, $2),
      'parentId', pg_temp.food_in(($1 -> 'food' ->> 'parentId')::uuid, $2),
      'aliases', pg_temp.rows_in($1 -> 'food' -> 'aliases', $2, NULL, 'id'),
      'lineFoods', pg_temp.rows_in($1 -> 'food' -> 'lineFoods', $2, 'lineId', 'aliasId'),
      'groceries', pg_temp.rows_in($1 -> 'food' -> 'groceries', $2, 'id', 'aliasId'),
      'recurring', pg_temp.rows_in($1 -> 'food' -> 'recurring', $2, 'id', 'aliasId')))
    WHEN 'spelling' THEN $1 || jsonb_build_object(
      'spelling', ($1 -> 'spelling') || jsonb_build_object('id', pg_temp.spelling_in(($1 -> 'spelling' ->> 'id')::uuid, $2)),
      'lines', (SELECT coalesce(jsonb_agg(e || jsonb_build_object('aliasIds', pg_temp.ids_in(e -> 'aliasIds', $2, 'spelling'))
        ORDER BY n), '[]'::jsonb) FROM jsonb_array_elements(pg_temp.rows_in($1 -> 'lines', $2, 'id')) WITH ORDINALITY AS t(e, n)),
      'groceries', pg_temp.ids_in($1 -> 'groceries', $2, 'row'),
      'recurring', pg_temp.ids_in($1 -> 'recurring', $2, 'row'))
      || CASE WHEN $1 ? 'left' THEN jsonb_build_object('left', (SELECT coalesce(jsonb_object_agg(pg_temp.row_in(k::uuid, $2),
        pg_temp.ids_in(v, $2, 'spelling')) FILTER (WHERE pg_temp.row_in(k::uuid, $2) IS NOT NULL), '{}'::jsonb)
        FROM jsonb_each($1 -> 'left') AS kv(k, v))) ELSE '{}'::jsonb END
    ELSE $1
  END
$$;--> statement-breakpoint
-- Every food, spelling and row id a change's undo names.
CREATE OR REPLACE FUNCTION "pg_temp"."undo_ids"(jsonb) RETURNS SETOF text LANGUAGE sql IMMUTABLE AS $$
  SELECT x FROM (
    SELECT $1 ->> 'parentId' UNION ALL SELECT jsonb_array_elements_text($1 -> 'aliasIds')
    UNION ALL SELECT $1 ->> 'formerParentId' UNION ALL SELECT $1 -> 'food' ->> 'parentId'
    UNION ALL SELECT $1 -> 'food' ->> 'ingredientId'
    UNION ALL SELECT e ->> 'id' FROM jsonb_array_elements($1 -> 'food' -> 'aliases') e
    UNION ALL SELECT x FROM jsonb_array_elements($1 -> 'food' -> 'lineFoods') e, LATERAL (VALUES (e ->> 'lineId'), (e ->> 'aliasId')) v(x)
    UNION ALL SELECT x FROM jsonb_array_elements($1 -> 'food' -> 'groceries') e, LATERAL (VALUES (e ->> 'id'), (e ->> 'aliasId')) v(x)
    UNION ALL SELECT x FROM jsonb_array_elements($1 -> 'food' -> 'recurring') e, LATERAL (VALUES (e ->> 'id'), (e ->> 'aliasId')) v(x)
    UNION ALL SELECT $1 -> 'spelling' ->> 'id'
    UNION ALL SELECT e ->> 'id' FROM jsonb_array_elements($1 -> 'lines') e
    UNION ALL SELECT jsonb_array_elements_text(e -> 'aliasIds') FROM jsonb_array_elements($1 -> 'lines') e
    UNION ALL SELECT jsonb_array_elements_text($1 -> 'groceries') UNION ALL SELECT jsonb_array_elements_text($1 -> 'recurring')
    UNION ALL SELECT jsonb_object_keys($1 -> 'left')
    UNION ALL SELECT jsonb_array_elements_text(v) FROM jsonb_each($1 -> 'left') AS kv(k, v)
  ) ids (x) WHERE x IS NOT NULL
$$;--> statement-breakpoint
-- Every change names only its household's foods, spellings and rows, or the seed's. One that named another
-- household's with no copy there keeps none of them, is listed still and cannot be undone (`stranded`), as
-- is one of a kind this migration does not know.
UPDATE "ingredient_ai_changes" ch SET "target_id" = m."target_id",
  "undo" = CASE WHEN m."stranded" THEN m."undo" || '{"stranded": true}'::jsonb ELSE m."undo" END
FROM (
  SELECT c."id", t."target_id", u."undo",
    (c."target_id" IS NOT NULL AND t."target_id" IS NULL)
      OR (SELECT count(*) FROM pg_temp.undo_ids(c."undo")) <> (SELECT count(*) FROM pg_temp.undo_ids(u."undo"))
      OR coalesce(c."undo" ->> 'kind', '') NOT IN ('merge', 'parent', 'plain-name', 'not-a-food', 'spelling') AS "stranded"
  FROM "ingredient_ai_changes" c
  CROSS JOIN LATERAL (SELECT pg_temp.food_in(c."target_id", c."household_id") AS "target_id") t
  CROSS JOIN LATERAL (SELECT pg_temp.undo_in(c."undo", c."household_id") AS "undo") u
) m
WHERE m."id" = ch."id";--> statement-breakpoint
-- The seed's junk stays the seed's; every other mark held for every household, so each still reads as before.
INSERT INTO "ingredient_junk_pile" ("household_id", "fold", "reason", "ai_change_id", "created_at")
SELECT h."id", j."fold", j."reason", CASE WHEN ch."household_id" = h."id" THEN j."ai_change_id" END, j."created_at"
FROM "ingredient_junk_pile" j CROSS JOIN "households" h
LEFT JOIN "ingredient_ai_changes" ch ON ch."id" = j."ai_change_id"
WHERE j."household_id" IS NULL AND j."reason" <> 'seed'
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "ingredient_junk_pile" WHERE "household_id" IS NULL AND "reason" <> 'seed';--> statement-breakpoint
DROP TABLE IF EXISTS "_catalogue_spelling_copies";--> statement-breakpoint
DROP TABLE IF EXISTS "_catalogue_food_copies";--> statement-breakpoint
DROP TABLE IF EXISTS "_catalogue_spellings_used";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_ingredients_household_name_lower" ON "ingredients" USING btree ("household_id",lower("name")) WHERE "ingredients"."household_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_ingredients_seed_name_lower" ON "ingredients" USING btree (lower("name")) WHERE "ingredients"."household_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_ingredient_aliases_household_fold" ON "ingredient_aliases" USING btree ("household_id","fold") WHERE "ingredient_aliases"."household_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_ingredient_aliases_seed_fold" ON "ingredient_aliases" USING btree ("fold") WHERE "ingredient_aliases"."household_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_ingredient_junk_pile_household_fold" ON "ingredient_junk_pile" USING btree ("household_id","fold") WHERE "ingredient_junk_pile"."household_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_ingredient_junk_pile_seed_fold" ON "ingredient_junk_pile" USING btree ("fold") WHERE "ingredient_junk_pile"."household_id" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingredient_ai_changes_household_id" ON "ingredient_ai_changes" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "ingredients" DROP CONSTRAINT IF EXISTS "ck_ingredients_seed_has_off_id";--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ck_ingredients_seed_has_off_id" CHECK (("ingredients"."household_id" is null) = ("ingredients"."off_id" is not null));
