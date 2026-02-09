CREATE TYPE "public"."item_type" AS ENUM('recipe', 'note');--> statement-breakpoint
CREATE TABLE "planned_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"slot" "slot_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"item_type" "item_type" NOT NULL,
	"recipe_id" uuid,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "planned_recipes" CASCADE;--> statement-breakpoint
DROP TABLE "notes" CASCADE;--> statement-breakpoint
ALTER TABLE "planned_items" ADD CONSTRAINT "planned_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_items" ADD CONSTRAINT "planned_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_planned_items_user_date" ON "planned_items" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_planned_items_user" ON "planned_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_planned_items_date_slot_order" ON "planned_items" USING btree ("date","slot","sort_order");--> statement-breakpoint
CREATE INDEX "idx_planned_items_recipe" ON "planned_items" USING btree ("recipe_id");