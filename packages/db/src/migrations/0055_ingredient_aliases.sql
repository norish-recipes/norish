CREATE TABLE "ingredient_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"fold" text NOT NULL,
	"locale" text,
	"ingredient_id" uuid NOT NULL,
	"owner_id" text,
	"seeded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "name" text;--> statement-breakpoint
-- A recipe line keeps its text as written; until now that was its Ingredient's name.
UPDATE "recipe_ingredients" SET "name" = "ingredients"."name"
FROM "ingredients" WHERE "ingredients"."id" = "recipe_ingredients"."ingredient_id";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "ingredient_alias_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_ingredient_aliases_fold" ON "ingredient_aliases" USING btree ("fold");--> statement-breakpoint
CREATE INDEX "idx_ingredient_aliases_ingredient_id" ON "ingredient_aliases" USING btree ("ingredient_id");--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_ingredient_alias_id" ON "recipe_ingredients" USING btree ("ingredient_alias_id");--> statement-breakpoint
-- An existing Ingredient belongs to whoever first used it: the owner of the
-- earliest recipe naming it, else the member who first put it in a Pantry.
UPDATE "ingredients" SET "owner_id" = "first_use"."user_id"
FROM (
	SELECT DISTINCT ON ("ingredient_id") "ingredient_id", "user_id"
	FROM (
		SELECT "recipe_ingredients"."ingredient_id", "recipes"."user_id", "recipe_ingredients"."created_at", 0 AS "rank"
		FROM "recipe_ingredients" INNER JOIN "recipes" ON "recipes"."id" = "recipe_ingredients"."recipe_id"
		WHERE "recipes"."user_id" IS NOT NULL
		UNION ALL
		SELECT "ingredient_id", "user_id", "created_at", 1 AS "rank" FROM "pantry_ingredients"
	) AS "uses"
	ORDER BY "ingredient_id", "rank", "created_at"
) AS "first_use"
WHERE "ingredients"."id" = "first_use"."ingredient_id";
