-- Recipes and cookbooks carry their Owner's household (ADR-0041), and nothing is left without an Owner.
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
ALTER TABLE "cookbooks" ADD COLUMN IF NOT EXISTS "household_id" uuid;--> statement-breakpoint
-- A row's household is always its Owner's: household row, then membership, as a move locks them.
-- A membership that moved meanwhile refuses the write (40001, retryable) rather than lock more.
-- A write keeping its Owner keeps the household; a move's own update (nested) is taken as it is.
CREATE OR REPLACE FUNCTION "set_owner_household"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  seen uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."user_id" = OLD."user_id" AND OLD."household_id" IS NOT NULL THEN
    NEW."household_id" := OLD."household_id";
    RETURN NEW;
  END IF;
  SELECT "household_id" INTO seen FROM "household_users" WHERE "user_id" = NEW."user_id";
  PERFORM 1 FROM "households" WHERE "id" = seen FOR KEY SHARE;
  SELECT "household_id" INTO NEW."household_id" FROM "household_users"
  WHERE "user_id" = NEW."user_id" FOR SHARE;
  IF NEW."household_id" IS DISTINCT FROM seen THEN
    RAISE EXCEPTION 'The Owner''s household changed during the write' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_recipes_owner_household" ON "recipes";--> statement-breakpoint
CREATE TRIGGER "trg_recipes_owner_household" BEFORE INSERT OR UPDATE OF "user_id", "household_id" ON "recipes"
FOR EACH ROW EXECUTE FUNCTION "set_owner_household"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_cookbooks_owner_household" ON "cookbooks";--> statement-breakpoint
CREATE TRIGGER "trg_cookbooks_owner_household" BEFORE INSERT OR UPDATE OF "user_id", "household_id" ON "cookbooks"
FOR EACH ROW EXECUTE FUNCTION "set_owner_household"();--> statement-breakpoint
-- Every membership move takes the Owner's recipes and cookbooks along, in the move's transaction.
CREATE OR REPLACE FUNCTION "move_owned_to_household"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "recipes" SET "household_id" = NEW."household_id"
  WHERE "user_id" = NEW."user_id" AND "household_id" IS DISTINCT FROM NEW."household_id";
  UPDATE "cookbooks" SET "household_id" = NEW."household_id"
  WHERE "user_id" = NEW."user_id" AND "household_id" IS DISTINCT FROM NEW."household_id";
  RETURN NULL;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_household_users_move_owned" ON "household_users";--> statement-breakpoint
CREATE TRIGGER "trg_household_users_move_owned" AFTER INSERT OR UPDATE OF "household_id", "user_id" ON "household_users"
FOR EACH ROW EXECUTE FUNCTION "move_owned_to_household"();--> statement-breakpoint
-- Orphans go to the server owner; with none flagged, the longest-standing admin, then account.
-- A URL the heir already has (or an older orphan brings) is cleared, so the recipe itself stays.
UPDATE "recipes" r SET "url" = NULL
WHERE r."user_id" IS NULL AND r."url" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "recipes" o
  WHERE o."url" = r."url" AND o."id" <> r."id"
    AND (o."user_id" = (SELECT "id" FROM "user" ORDER BY "isServerOwner" DESC, "isServerAdmin" DESC, "createdAt", "id" LIMIT 1)
      OR (o."user_id" IS NULL AND (o."created_at", o."id") < (r."created_at", r."id")))
);--> statement-breakpoint
UPDATE "recipes" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "isServerOwner" DESC, "isServerAdmin" DESC, "createdAt", "id" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "cookbooks" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "isServerOwner" DESC, "isServerAdmin" DESC, "createdAt", "id" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
-- Only a server without a single account is left with orphans: no one could ever own them.
DELETE FROM "recipes" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "cookbooks" WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "recipes" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE hu."user_id" = t."user_id" AND t."household_id" IS DISTINCT FROM hu."household_id";--> statement-breakpoint
UPDATE "cookbooks" t SET "household_id" = hu."household_id" FROM "household_users" hu
WHERE hu."user_id" = t."user_id" AND t."household_id" IS DISTINCT FROM hu."household_id";--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cookbooks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cookbooks" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
-- A NOT NULL Owner cannot be set null; ticket 04 sweeps an erased account's files and plan.
ALTER TABLE "recipes" DROP CONSTRAINT IF EXISTS "recipes_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookbooks" DROP CONSTRAINT IF EXISTS "cookbooks_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "cookbooks" ADD CONSTRAINT "cookbooks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT IF EXISTS "recipes_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookbooks" DROP CONSTRAINT IF EXISTS "cookbooks_household_id_households_id_fk";--> statement-breakpoint
ALTER TABLE "cookbooks" ADD CONSTRAINT "cookbooks_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipes_household_id" ON "recipes" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cookbooks_household_id" ON "cookbooks" USING btree ("household_id");
