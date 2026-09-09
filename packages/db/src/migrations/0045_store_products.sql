CREATE TABLE "store_product_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"normalized_name" text NOT NULL,
	"store_product_id" uuid,
	"tried_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_store_product_links_store_name" UNIQUE("store_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"page_url" text,
	"price" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"size" text,
	"priced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_store_products_store_page" UNIQUE("store_id","page_url")
);
--> statement-breakpoint
ALTER TABLE "store_product_links" ADD CONSTRAINT "store_product_links_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_links" ADD CONSTRAINT "store_product_links_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_product_links_store_id" ON "store_product_links" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_store_product_links_product_id" ON "store_product_links" USING btree ("store_product_id");--> statement-breakpoint
CREATE INDEX "idx_store_products_store_id" ON "store_products" USING btree ("store_id");