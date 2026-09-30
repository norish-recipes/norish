CREATE TABLE "ingredient_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" uuid,
	"english_name" text,
	"considered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_suggestions" ADD CONSTRAINT "ingredient_suggestions_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_suggestions" ADD CONSTRAINT "ingredient_suggestions_target_id_ingredients_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_ingredient_suggestions_ingredient_id" ON "ingredient_suggestions" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_ingredient_suggestions_target_id" ON "ingredient_suggestions" USING btree ("target_id");