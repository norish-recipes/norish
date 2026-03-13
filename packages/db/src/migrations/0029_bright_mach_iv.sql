ALTER TABLE "user" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint

UPDATE "user"
SET preferences = coalesce(preferences, '{}'::jsonb) || jsonb_build_object('locale', locale)
WHERE locale IS NOT NULL;

ALTER TABLE "user" DROP COLUMN "locale";