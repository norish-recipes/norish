CREATE TABLE "step_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid NOT NULL,
	"recipe_ingredient_id" uuid NOT NULL,
	"share" numeric(8, 4) DEFAULT '1' NOT NULL,
	"order" numeric DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "step_ingredients" ADD CONSTRAINT "step_ingredients_step_id_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_ingredients" ADD CONSTRAINT "step_ingredients_recipe_ingredient_id_recipe_ingredients_id_fk" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "public"."recipe_ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_step_ingredients_step_id" ON "step_ingredients" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "idx_step_ingredients_recipe_ingredient_id" ON "step_ingredients" USING btree ("recipe_ingredient_id");