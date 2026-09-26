ALTER TABLE "groceries" ADD COLUMN "ingredient_alias_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD COLUMN "ingredient_alias_id" uuid;--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_groceries" ADD CONSTRAINT "recurring_groceries_ingredient_alias_id_ingredient_aliases_id_fk" FOREIGN KEY ("ingredient_alias_id") REFERENCES "public"."ingredient_aliases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_groceries_ingredient_alias_id" ON "groceries" USING btree ("ingredient_alias_id");