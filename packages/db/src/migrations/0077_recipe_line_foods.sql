-- A recipe line's foods are a list (ADR-0037): one row per food, in order,
-- each an Ingredient Alias. Every line moves its alias to position 0, with no
-- fallback; a line naming no food (a heading) gets no row. `joined` stays
-- empty until a line names several.
CREATE TYPE "public"."recipe_ingredient_join" AS ENUM('together', 'alternatives');--> statement-breakpoint
CREATE TABLE "recipe_ingredient_foods" (
	"recipe_ingredient_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"ingredient_alias_id" uuid NOT NULL,
	CONSTRAINT "recipe_ingredient_foods_recipe_ingredient_id_position_pk" PRIMARY KEY("recipe_ingredient_id","position")
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "joined" "recipe_ingredient_join";--> statement-breakpoint
ALTER TABLE "recipe_ingredient_foods" ADD CONSTRAINT "recipe_ingredient_foods_recipe_ingredient_id_recipe_ingredients_id_fk" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "public"."recipe_ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient_foods" ADD CONSTRAINT "recipe_ingredient_foods_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredient_foods_ingredient_alias_id" ON "recipe_ingredient_foods" USING btree ("ingredient_alias_id");--> statement-breakpoint
INSERT INTO "recipe_ingredient_foods" ("recipe_ingredient_id", "position", "ingredient_alias_id")
SELECT "id", 0, "ingredient_alias_id" FROM "recipe_ingredients" WHERE "ingredient_alias_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_ingredient_alias_id_ingredient_aliases_id_fk";
--> statement-breakpoint
DROP INDEX "idx_recipe_ingredients_ingredient_alias_id";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" DROP COLUMN "ingredient_alias_id";
