CREATE TABLE "ingredient_store_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"normalized_name" text NOT NULL,
	"store_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ingredient_store_prefs_user_name" UNIQUE("user_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'primary' NOT NULL,
	"icon" text DEFAULT 'ShoppingBagIcon' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groceries" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "ingredient_store_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "ingredient_store_preferences_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ingredient_store_prefs_user_id" ON "ingredient_store_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ingredient_store_prefs_store_id" ON "ingredient_store_preferences" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_stores_user_id" ON "stores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stores_sort_order" ON "stores" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_groceries_store_id" ON "groceries" USING btree ("store_id");