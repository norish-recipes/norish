ALTER TABLE "store_product_links" ALTER COLUMN "tried_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "store_product_links" ALTER COLUMN "tried_at" DROP NOT NULL;