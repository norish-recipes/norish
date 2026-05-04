DO $$ BEGIN
 CREATE TYPE "public"."cuisine_enum" AS ENUM('American', 'British', 'Caribbean', 'Chinese', 'French', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Latin American', 'Lebanese', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Spanish', 'Thai', 'Vietnamese', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "origin" varchar(2);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "origin_sub_region" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "cuisines" "cuisine_enum"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "origin_reason" text;