ALTER TABLE "recipes" ADD COLUMN "calories" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "fat" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "carbs" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "protein" numeric(6, 2);