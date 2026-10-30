-- AI's estimates of a food's missing nutrition, density and piece weight (Fill Gaps), instance-wide.
CREATE TABLE "ingredient_nutrition_estimates" (
	"ingredient_id" uuid PRIMARY KEY NOT NULL,
	"kcal" double precision,
	"fat" double precision,
	"carbs" double precision,
	"protein" double precision,
	"piece_weight" double precision,
	"pieceless" boolean DEFAULT false NOT NULL,
	"density" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_estimates" ADD CONSTRAINT "ingredient_nutrition_estimates_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;