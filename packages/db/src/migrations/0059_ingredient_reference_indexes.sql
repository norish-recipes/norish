CREATE INDEX "idx_recurring_groceries_ingredient_alias_id" ON "recurring_groceries" USING btree ("ingredient_alias_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_groceries_ingredient_id" ON "recurring_groceries" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_pantry_ingredients_ingredient_alias_id" ON "pantry_ingredients" USING btree ("ingredient_alias_id");