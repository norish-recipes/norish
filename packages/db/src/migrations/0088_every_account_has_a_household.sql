-- Every account is in exactly one household (ADR-0041). An account in several keeps its first.
DELETE FROM "household_users" hu USING "household_users" earlier
WHERE earlier."user_id" = hu."user_id"
  AND (earlier."created_at", earlier."household_id") < (hu."created_at", hu."household_id");--> statement-breakpoint
DELETE FROM "households" h
WHERE NOT EXISTS (SELECT 1 FROM "household_users" hu WHERE hu."household_id" = h."id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_household_users_user_id";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_household_users_user_id" ON "household_users" USING btree ("user_id");--> statement-breakpoint
-- An account without a household gets a household of one, named as sign-up names one.
WITH made AS (
  INSERT INTO "households" ("name", "admin_user_id")
  SELECT 'My household', u."id" FROM "user" u
  WHERE NOT EXISTS (SELECT 1 FROM "household_users" hu WHERE hu."user_id" = u."id")
  RETURNING "id", "admin_user_id"
)
INSERT INTO "household_users" ("household_id", "user_id")
SELECT "id", "admin_user_id" FROM made;
--> statement-breakpoint
-- Every new account, by any Sign-in Method, gets its household of one in the transaction that creates it.
CREATE OR REPLACE FUNCTION "create_household_of_one"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE made uuid;
BEGIN
  INSERT INTO "households" ("name", "admin_user_id") VALUES ('My household', NEW."id") RETURNING "id" INTO made;
  INSERT INTO "household_users" ("household_id", "user_id") VALUES (made, NEW."id");
  RETURN NULL;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_user_household_of_one" ON "user";--> statement-breakpoint
CREATE TRIGGER "trg_user_household_of_one" AFTER INSERT ON "user"
FOR EACH ROW EXECUTE FUNCTION "create_household_of_one"();
