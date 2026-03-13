ALTER TABLE "recipes" ALTER COLUMN "system_used" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "system_used" SET DEFAULT 'metric'::text;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "system_used" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "system_used" SET DEFAULT 'metric'::text;--> statement-breakpoint
ALTER TABLE "steps" ALTER COLUMN "system_used" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "steps" ALTER COLUMN "system_used" SET DEFAULT 'metric'::text;--> statement-breakpoint
DROP TYPE "public"."measurement_system";--> statement-breakpoint
CREATE TYPE "public"."measurement_system" AS ENUM('metric', 'us');--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "system_used" SET DEFAULT 'metric'::"public"."measurement_system";--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "system_used" SET DATA TYPE "public"."measurement_system" USING "system_used"::"public"."measurement_system";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "system_used" SET DEFAULT 'metric'::"public"."measurement_system";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "system_used" SET DATA TYPE "public"."measurement_system" USING "system_used"::"public"."measurement_system";--> statement-breakpoint
ALTER TABLE "steps" ALTER COLUMN "system_used" SET DEFAULT 'metric'::"public"."measurement_system";--> statement-breakpoint
ALTER TABLE "steps" ALTER COLUMN "system_used" SET DATA TYPE "public"."measurement_system" USING "system_used"::"public"."measurement_system";--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "rateLimitTimeWindow" SET DEFAULT 60000;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "rateLimitMax" SET DEFAULT 100;