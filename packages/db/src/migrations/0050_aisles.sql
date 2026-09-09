CREATE TABLE "aisle_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"normalized_name" text NOT NULL,
	"aisle_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_aisle_links_store_name" UNIQUE("store_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "aisles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aisle_links" ADD CONSTRAINT "aisle_links_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisle_links" ADD CONSTRAINT "aisle_links_aisle_id_aisles_id_fk" FOREIGN KEY ("aisle_id") REFERENCES "public"."aisles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aisles" ADD CONSTRAINT "aisles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aisle_links_store_id" ON "aisle_links" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_aisle_links_aisle_id" ON "aisle_links" USING btree ("aisle_id");--> statement-breakpoint
CREATE INDEX "idx_aisles_store_id" ON "aisles" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_aisles_store_name_lower" ON "aisles" USING btree ("store_id",lower("name"));