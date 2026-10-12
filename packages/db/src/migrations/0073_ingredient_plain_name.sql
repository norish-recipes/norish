ALTER TABLE "ingredient_suggestions" ADD COLUMN "proposed_name" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "name_settled" boolean DEFAULT false NOT NULL;