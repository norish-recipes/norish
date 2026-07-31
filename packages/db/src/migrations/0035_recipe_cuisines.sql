CREATE TABLE "cuisines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_cuisines" (
	"recipe_id" uuid NOT NULL,
	"cuisine_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pk_recipe_cuisines" PRIMARY KEY("recipe_id","cuisine_id")
);
--> statement-breakpoint
ALTER TABLE "recipe_cuisines" ADD CONSTRAINT "recipe_cuisines_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cuisines" ADD CONSTRAINT "recipe_cuisines_cuisine_id_cuisines_id_fk" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_cuisines_name_lower" ON "cuisines" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_cuisines_created_at" ON "cuisines" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_recipe_cuisines_recipe_id" ON "recipe_cuisines" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_cuisines_cuisine_id" ON "recipe_cuisines" USING btree ("cuisine_id");--> statement-breakpoint
-- Seed the starting Cuisine vocabulary exactly once.
--
-- This is a versioned migration and deliberately NOT a boot-time reconcile: a
-- Cuisine an administrator deletes must stay deleted across restarts and
-- upgrades. Names are canonical identifiers seeded in English and shown
-- verbatim in every locale; an administrator who wants them in their own
-- language renames them (ADR-0012).
--
-- `Other` is deliberately absent: as a row it is a null-object that lets AI
-- avoid choosing, and an empty Cuisine set already means "nothing fits".
INSERT INTO "cuisines" ("name") VALUES
	('American'),
	('Argentinian'),
	('Asian'),
	('Brazilian'),
	('British'),
	('Cajun'),
	('Caribbean'),
	('Chinese'),
	('Cuban'),
	('Ethiopian'),
	('Filipino'),
	('French'),
	('German'),
	('Greek'),
	('Hungarian'),
	('Indian'),
	('Indonesian'),
	('Irish'),
	('Italian'),
	('Japanese'),
	('Korean'),
	('Lebanese'),
	('Malaysian'),
	('Mediterranean'),
	('Mexican'),
	('Middle Eastern'),
	('Moroccan'),
	('Nordic'),
	('Peruvian'),
	('Polish'),
	('Portuguese'),
	('Russian'),
	('Spanish'),
	('Swedish'),
	('Thai'),
	('Turkish'),
	('Vietnamese')
ON CONFLICT DO NOTHING;