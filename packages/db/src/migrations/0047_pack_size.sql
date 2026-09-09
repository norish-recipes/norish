ALTER TABLE "store_products" ADD COLUMN "pack_quantity" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "pack_unit" text;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "pack_by_weight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "pack_by_hand" boolean DEFAULT false NOT NULL;