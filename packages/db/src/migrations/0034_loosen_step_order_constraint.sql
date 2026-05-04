DROP INDEX IF EXISTS "unique_recipe_step_system";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_recipe_step_system" ON "steps" USING btree ("recipe_id","step","system_used","order");
