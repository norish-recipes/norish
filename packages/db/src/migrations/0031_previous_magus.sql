ALTER TABLE "apikey" ADD COLUMN "configId" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "cuisines" "cuisine_enum"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "cuisine_style";