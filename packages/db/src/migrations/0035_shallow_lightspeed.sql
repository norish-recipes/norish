ALTER TABLE "recipes" ADD COLUMN "origin_country_code" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cuisines" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "provenance_note" text;