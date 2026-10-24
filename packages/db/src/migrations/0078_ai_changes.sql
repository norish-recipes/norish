-- AI applies its answers about Ingredients as AI Changes a person keeps or undoes (ADR-0037);
-- suggestions go. name_chosen marks a food a person named, which AI leaves alone.
CREATE TABLE "ingredient_ai_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"target_id" uuid,
	"sure" boolean NOT NULL,
	"undo" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kept_at" timestamp with time zone,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
DROP TABLE "ingredient_suggestions" CASCADE;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "name_chosen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_ai_changes" ADD CONSTRAINT "ingredient_ai_changes_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_ai_changes" ADD CONSTRAINT "ingredient_ai_changes_target_id_ingredients_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ingredient_ai_changes_ingredient_id" ON "ingredient_ai_changes" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_ingredient_ai_changes_created_at" ON "ingredient_ai_changes" USING btree ("created_at");