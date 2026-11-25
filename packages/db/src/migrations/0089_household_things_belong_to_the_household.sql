-- Household rows belong to the household (ADR-0041); "user_id" stays only as who added them.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "groceries" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "planned_items" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
-- Each row goes to the household its adder is in now; 0088 gave every account exactly one.
UPDATE "stores" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE t."household_id" IS NULL AND hu."user_id" = t."user_id";--> statement-breakpoint
UPDATE "groceries" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE t."household_id" IS NULL AND hu."user_id" = t."user_id";--> statement-breakpoint
UPDATE "recurring_groceries" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE t."household_id" IS NULL AND hu."user_id" = t."user_id";--> statement-breakpoint
UPDATE "pantry_ingredients" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE t."household_id" IS NULL AND hu."user_id" = t."user_id";--> statement-breakpoint
UPDATE "planned_items" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE t."household_id" IS NULL AND hu."user_id" = t."user_id";--> statement-breakpoint
UPDATE "ingredient_nutrition_corrections" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE t."household_id" IS NULL AND hu."user_id" = t."user_id";--> statement-breakpoint
-- A store preference is its store's knowledge, so it stays with the store's household.
UPDATE "ingredient_store_preferences" t SET "household_id" = s."household_id" FROM "stores" s
WHERE t."household_id" IS NULL AND s."id" = t."store_id";--> statement-breakpoint
-- A member who moved left groceries pointing at the old household's store or recurring grocery.
UPDATE "groceries" g SET "store_id" = NULL FROM "stores" s
WHERE s."id" = g."store_id" AND s."household_id" <> g."household_id";--> statement-breakpoint
UPDATE "groceries" g SET "recurring_grocery_id" = NULL FROM "recurring_groceries" r
WHERE r."id" = g."recurring_grocery_id" AND r."household_id" <> g."household_id";--> statement-breakpoint
-- One per household: the Pantry keeps its first row of a food, the same food at home.
DELETE FROM "pantry_ingredients" p USING "pantry_ingredients" kept
WHERE kept."household_id" = p."household_id" AND kept."ingredient_id" = p."ingredient_id"
  AND (kept."created_at", kept."id") < (p."created_at", p."id");--> statement-breakpoint
-- Corrections and store preferences keep the most recent, the one reads already chose.
DELETE FROM "ingredient_nutrition_corrections" c USING "ingredient_nutrition_corrections" kept
WHERE kept."household_id" = c."household_id" AND kept."ingredient_id" = c."ingredient_id"
  AND (kept."updated_at", kept."id") > (c."updated_at", c."id");--> statement-breakpoint
DELETE FROM "ingredient_store_preferences" p USING "ingredient_store_preferences" kept
WHERE kept."household_id" = p."household_id" AND kept."ingredient_id" = p."ingredient_id"
  AND (kept."updated_at", kept."id") > (p."updated_at", p."id");--> statement-breakpoint
ALTER TABLE "stores" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groceries" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_items" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "groceries" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "planned_items" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "stores_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "stores_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groceries" DROP CONSTRAINT IF EXISTS "groceries_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groceries" DROP CONSTRAINT IF EXISTS "groceries_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_groceries" DROP CONSTRAINT IF EXISTS "recurring_groceries_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_groceries" DROP CONSTRAINT IF EXISTS "recurring_groceries_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" DROP CONSTRAINT IF EXISTS "pantry_ingredients_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "pantry_ingredients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" DROP CONSTRAINT IF EXISTS "pantry_ingredients_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "pantry_ingredients_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_items" DROP CONSTRAINT IF EXISTS "planned_items_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "planned_items" ADD CONSTRAINT "planned_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_items" DROP CONSTRAINT IF EXISTS "planned_items_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "planned_items" ADD CONSTRAINT "planned_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" DROP CONSTRAINT IF EXISTS "ingredient_nutrition_corrections_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD CONSTRAINT "ingredient_nutrition_corrections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" DROP CONSTRAINT IF EXISTS "ingredient_nutrition_corrections_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD CONSTRAINT "ingredient_nutrition_corrections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP CONSTRAINT IF EXISTS "ingredient_store_preferences_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "ingredient_store_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP CONSTRAINT IF EXISTS "ingredient_store_preferences_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "ingredient_store_preferences_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" DROP CONSTRAINT IF EXISTS "uq_pantry_ingredients_user_ingredient";--> statement-breakpoint
ALTER TABLE "pantry_ingredients" DROP CONSTRAINT IF EXISTS "uq_pantry_ingredients_household_ingredient";--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "uq_pantry_ingredients_household_ingredient" UNIQUE("household_id","ingredient_id");--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" DROP CONSTRAINT IF EXISTS "uq_ingredient_nutrition_corrections_user_ingredient";--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" DROP CONSTRAINT IF EXISTS "uq_ingredient_nutrition_corrections_household_ingredient";--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD CONSTRAINT "uq_ingredient_nutrition_corrections_household_ingredient" UNIQUE("household_id","ingredient_id");--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP CONSTRAINT IF EXISTS "uq_ingredient_store_prefs_user_ingredient";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" DROP CONSTRAINT IF EXISTS "uq_ingredient_store_prefs_household_ingredient";--> statement-breakpoint
ALTER TABLE "ingredient_store_preferences" ADD CONSTRAINT "uq_ingredient_store_prefs_household_ingredient" UNIQUE("household_id","ingredient_id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_planned_items_user_date";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stores_household_id" ON "stores" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_groceries_household_id" ON "groceries" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recurring_groceries_household_id" ON "recurring_groceries" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_planned_items_household_date" ON "planned_items" USING btree ("household_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingredient_nutrition_corrections_user_id" ON "ingredient_nutrition_corrections" USING btree ("user_id");
