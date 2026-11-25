-- Tags, Cuisines and Categories are household lists (ADR-0043): a row carries its household, null
-- for an instance entry, and is unique on its folded name within the household or the instance.
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "name_fold" text;--> statement-breakpoint
ALTER TABLE "cuisines" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "cuisines" ADD COLUMN IF NOT EXISTS "name_fold" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "name_fold" text;--> statement-breakpoint
DROP INDEX IF EXISTS "uqidx_tags_name_lower";--> statement-breakpoint
DROP INDEX IF EXISTS "uqidx_cuisines_name_lower";--> statement-breakpoint
DROP INDEX IF EXISTS "uqidx_categories_name_lower";--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuisines" DROP CONSTRAINT IF EXISTS "cuisines_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "cuisines" ADD CONSTRAINT "cuisines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Allergies become the names their Tags had; a Tag's deletion always took its allergies with it.
ALTER TABLE "user_allergies" ADD COLUMN IF NOT EXISTS "name" text;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_allergies' AND column_name = 'tag_id') THEN
    UPDATE "user_allergies" a SET "name" = t."name" FROM "tags" t
    WHERE a."name" IS NULL AND t."id" = a."tag_id";
  END IF;
END $$;--> statement-breakpoint
DELETE FROM "user_allergies" WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "user_allergies" DROP CONSTRAINT IF EXISTS "user_allergies_tag_id_tags_id_fk";--> statement-breakpoint
ALTER TABLE "user_allergies" DROP CONSTRAINT IF EXISTS "pk_user_allergies";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_allergies_tag_id";--> statement-breakpoint
ALTER TABLE "user_allergies" DROP COLUMN IF EXISTS "tag_id";--> statement-breakpoint
ALTER TABLE "user_allergies" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_allergies" ADD CONSTRAINT "pk_user_allergies" PRIMARY KEY("user_id","name");--> statement-breakpoint
-- No row records who made it, so the household of the oldest recipe carrying it keeps the original.
UPDATE "tags" t SET "household_id" = o."household_id" FROM (
  SELECT DISTINCT ON (rt."tag_id") rt."tag_id", r."household_id"
  FROM "recipe_tags" rt JOIN "recipes" r ON r."id" = rt."recipe_id"
  ORDER BY rt."tag_id", r."created_at", r."id"
) o WHERE t."household_id" IS NULL AND t."id" = o."tag_id";--> statement-breakpoint
UPDATE "categories" c SET "household_id" = o."household_id" FROM (
  SELECT DISTINCT ON (rc."category_id") rc."category_id", r."household_id"
  FROM "recipe_categories" rc JOIN "recipes" r ON r."id" = rc."recipe_id"
  ORDER BY rc."category_id", r."created_at", r."id"
) o WHERE c."household_id" IS NULL AND c."id" = o."category_id"
  AND lower(c."name") NOT IN ('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
-- Every other household using a row gets its own copy, and its recipes are pointed at it.
WITH "pairs" AS MATERIALIZED (
  SELECT d."tag_id", d."household_id", gen_random_uuid() AS "copy_id" FROM (
    SELECT DISTINCT rt."tag_id", r."household_id"
    FROM "recipe_tags" rt JOIN "recipes" r ON r."id" = rt."recipe_id"
    JOIN "tags" t ON t."id" = rt."tag_id"
    WHERE r."household_id" <> t."household_id"
  ) d
), "copied" AS (
  INSERT INTO "tags" ("id", "household_id", "name", "created_at")
  SELECT p."copy_id", p."household_id", t."name", t."created_at"
  FROM "pairs" p JOIN "tags" t ON t."id" = p."tag_id"
)
UPDATE "recipe_tags" rt SET "tag_id" = p."copy_id" FROM "pairs" p, "recipes" r
WHERE r."id" = rt."recipe_id" AND rt."tag_id" = p."tag_id" AND r."household_id" = p."household_id";--> statement-breakpoint
WITH "pairs" AS MATERIALIZED (
  SELECT d."category_id", d."household_id", gen_random_uuid() AS "copy_id" FROM (
    SELECT DISTINCT rc."category_id", r."household_id"
    FROM "recipe_categories" rc JOIN "recipes" r ON r."id" = rc."recipe_id"
    JOIN "categories" c ON c."id" = rc."category_id"
    WHERE r."household_id" <> c."household_id"
  ) d
), "copied" AS (
  INSERT INTO "categories" ("id", "household_id", "name", "created_at")
  SELECT p."copy_id", p."household_id", c."name", c."created_at"
  FROM "pairs" p JOIN "categories" c ON c."id" = p."category_id"
)
UPDATE "recipe_categories" rc SET "category_id" = p."copy_id" FROM "pairs" p, "recipes" r
WHERE r."id" = rc."recipe_id" AND rc."category_id" = p."category_id"
  AND r."household_id" = p."household_id";--> statement-breakpoint
-- A row no recipe carries belonged to nobody (the sweeps kept it only for an allergy), so it goes.
DELETE FROM "tags" t WHERE t."household_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "recipe_tags" rt WHERE rt."tag_id" = t."id");--> statement-breakpoint
DELETE FROM "categories" c WHERE c."household_id" IS NULL
  AND lower(c."name") NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
  AND NOT EXISTS (SELECT 1 FROM "recipe_categories" rc WHERE rc."category_id" = c."id");--> statement-breakpoint
-- An ASCII name folds exactly here (foldName drops ^ and ` as diacritics). Any other name, or one
-- folding like another row of its list, is keyed by its id until the boot upgrade folds and merges it.
UPDATE "tags" t SET "name_fold" = f."fold" FROM (
  SELECT "id", "fold", count(*) OVER (PARTITION BY "household_id", "fold") AS "n" FROM (
    SELECT "id", "household_id", btrim(regexp_replace(translate(replace(replace("name", '^', ''), '`', ''),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '[^a-z0-9]+', ' ', 'g'), ' ') AS "fold"
    FROM "tags" WHERE "name_fold" IS NULL AND octet_length("name") = char_length("name")
  ) a
) f WHERE t."id" = f."id" AND f."n" = 1 AND f."fold" <> '' AND NOT EXISTS (
  SELECT 1 FROM "tags" o WHERE o."name_fold" = f."fold" AND o."household_id" IS NOT DISTINCT FROM t."household_id"
);--> statement-breakpoint
UPDATE "categories" t SET "name_fold" = f."fold" FROM (
  SELECT "id", "fold", count(*) OVER (PARTITION BY "household_id", "fold") AS "n" FROM (
    SELECT "id", "household_id", btrim(regexp_replace(translate(replace(replace("name", '^', ''), '`', ''),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '[^a-z0-9]+', ' ', 'g'), ' ') AS "fold"
    FROM "categories" WHERE "name_fold" IS NULL AND octet_length("name") = char_length("name")
  ) a
) f WHERE t."id" = f."id" AND f."n" = 1 AND f."fold" <> '' AND NOT EXISTS (
  SELECT 1 FROM "categories" o WHERE o."name_fold" = f."fold" AND o."household_id" IS NOT DISTINCT FROM t."household_id"
);--> statement-breakpoint
UPDATE "cuisines" t SET "name_fold" = f."fold" FROM (
  SELECT "id", "fold", count(*) OVER (PARTITION BY "household_id", "fold") AS "n" FROM (
    SELECT "id", "household_id", btrim(regexp_replace(translate(replace(replace("name", '^', ''), '`', ''),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '[^a-z0-9]+', ' ', 'g'), ' ') AS "fold"
    FROM "cuisines" WHERE "name_fold" IS NULL AND octet_length("name") = char_length("name")
  ) a
) f WHERE t."id" = f."id" AND f."n" = 1 AND f."fold" <> '' AND NOT EXISTS (
  SELECT 1 FROM "cuisines" o WHERE o."name_fold" = f."fold" AND o."household_id" IS NOT DISTINCT FROM t."household_id"
);--> statement-breakpoint
UPDATE "tags" SET "name_fold" = ' ' || "id"::text WHERE "name_fold" IS NULL;--> statement-breakpoint
UPDATE "categories" SET "name_fold" = ' ' || "id"::text WHERE "name_fold" IS NULL;--> statement-breakpoint
UPDATE "cuisines" SET "name_fold" = ' ' || "id"::text WHERE "name_fold" IS NULL;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "name_fold" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "name_fold" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cuisines" ALTER COLUMN "name_fold" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tags_household_fold" ON "tags" USING btree ("household_id","name_fold") WHERE "tags"."household_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_tags_instance_fold" ON "tags" USING btree ("name_fold") WHERE "tags"."household_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cuisines_household_fold" ON "cuisines" USING btree ("household_id","name_fold") WHERE "cuisines"."household_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cuisines_instance_fold" ON "cuisines" USING btree ("name_fold") WHERE "cuisines"."household_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_categories_household_fold" ON "categories" USING btree ("household_id","name_fold") WHERE "categories"."household_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_categories_instance_fold" ON "categories" USING btree ("name_fold") WHERE "categories"."household_id" IS NULL;
