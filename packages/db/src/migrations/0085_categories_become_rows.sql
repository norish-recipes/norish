CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_categories" (
	"recipe_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pk_recipe_categories" PRIMARY KEY("recipe_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_categories_name_lower" ON "categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_recipe_categories_category_id" ON "recipe_categories" USING btree ("category_id");--> statement-breakpoint
-- The four built-ins are rows from here on, and every recipe keeps its enum values as join rows.
INSERT INTO "categories" ("name") VALUES ('Breakfast'), ('Lunch'), ('Dinner'), ('Snack');--> statement-breakpoint
INSERT INTO "recipe_categories" ("recipe_id", "category_id", "order")
SELECT r."id", c."id", (u.ordinality - 1)::int
FROM "recipes" r
CROSS JOIN LATERAL unnest(r."categories") WITH ORDINALITY AS u(category, ordinality)
JOIN "categories" c ON c."name" = u.category::text
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "categories";--> statement-breakpoint
DROP TYPE "public"."recipe_category";