CREATE TABLE "recipe_nutrition_estimates" (
	"recipe_id" uuid PRIMARY KEY NOT NULL,
	"calories" double precision NOT NULL,
	"fat" double precision NOT NULL,
	"carbs" double precision NOT NULL,
	"protein" double precision NOT NULL,
	"lines" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_nutrition_estimates" ADD CONSTRAINT "recipe_nutrition_estimates_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;