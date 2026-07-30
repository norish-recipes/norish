-- Cuisine leaves the predefined Tag vocabulary.
--
-- Ten of the predefined auto-tagging Tags were cuisines. This moves them onto
-- the Cuisine vocabulary seeded in 0035 and removes the Tags that matched.
--
-- Only Tags matching the vocabulary are touched: free-form cuisine-like Tags a
-- person typed (`sicilian`, `tex-mex`, `levantine`) are folksonomy and stay.
-- Cuisine leaves the *predefined* Tag vocabulary, not Tags altogether.
--
-- `cuisine_tag_migrations` is the audit record, because removing the Tags is
-- not reversible from within the application. Every data statement below is
-- written so that running it again changes nothing.
CREATE TABLE IF NOT EXISTS "cuisine_tag_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"tag_name" text NOT NULL,
	"cuisine_id" uuid,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuisine_tag_migrations" DROP CONSTRAINT IF EXISTS "cuisine_tag_migrations_cuisine_id_cuisines_id_fk";--> statement-breakpoint
ALTER TABLE "cuisine_tag_migrations" ADD CONSTRAINT "cuisine_tag_migrations_cuisine_id_cuisines_id_fk" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cuisine_tag_migrations_recipe_id" ON "cuisine_tag_migrations" USING btree ("recipe_id");
--> statement-breakpoint
-- Record what is about to be removed, per recipe. Only rows that still exist
-- are recorded, so a repeat run adds nothing.
INSERT INTO "cuisine_tag_migrations" ("recipe_id", "tag_name", "cuisine_id")
SELECT rt."recipe_id", t."name", c."id"
FROM "recipe_tags" rt
JOIN "tags" t ON t."id" = rt."tag_id"
JOIN "cuisines" c ON lower(c."name") = lower(t."name");--> statement-breakpoint
-- Attach the corresponding Cuisine to every recipe holding a matched Tag,
-- after whatever Cuisines the recipe already has.
INSERT INTO "recipe_cuisines" ("recipe_id", "cuisine_id", "order")
SELECT
	matched."recipe_id",
	matched."cuisine_id",
	COALESCE(
		(SELECT MAX(rc."order") + 1 FROM "recipe_cuisines" rc WHERE rc."recipe_id" = matched."recipe_id"),
		0
	) + matched."position" - 1
FROM (
	SELECT
		rt."recipe_id",
		c."id" AS "cuisine_id",
		ROW_NUMBER() OVER (PARTITION BY rt."recipe_id" ORDER BY rt."order", t."name") AS "position"
	FROM "recipe_tags" rt
	JOIN "tags" t ON t."id" = rt."tag_id"
	JOIN "cuisines" c ON lower(c."name") = lower(t."name")
) AS matched
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Remove the matched Tags from the recipes that carried them.
DELETE FROM "recipe_tags" rt
USING "tags" t, "cuisines" c
WHERE rt."tag_id" = t."id"
	AND lower(c."name") = lower(t."name");--> statement-breakpoint
-- Remove the now-orphaned tag rows. This is load-bearing rather than tidiness:
-- under the `predefined_db` tag strategy the auto-tagging prompt injects every
-- existing tag name back in as an allowed tag, so a surviving orphan would keep
-- cuisine in circulation after the migration meant to end it.
--
-- A tag someone recorded as an allergy is left alone: `user_allergies` cascades
-- on delete, so removing it would silently drop that person's allergy.
DELETE FROM "tags" t
WHERE EXISTS (SELECT 1 FROM "cuisines" c WHERE lower(c."name") = lower(t."name"))
	AND NOT EXISTS (SELECT 1 FROM "recipe_tags" rt WHERE rt."tag_id" = t."id")
	AND NOT EXISTS (SELECT 1 FROM "user_allergies" ua WHERE ua."tag_id" = t."id");
