CREATE TYPE "public"."cuisine_enum" AS ENUM('American', 'British', 'Caribbean', 'Chinese', 'French', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Latin American', 'Lebanese', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Spanish', 'Thai', 'Vietnamese', 'Other');--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "origin" varchar(2);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "origin_sub_region" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cuisines" "cuisine_enum"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "origin_reason" text;