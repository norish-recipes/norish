ALTER TABLE "ingredients" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_parent_id_ingredients_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ingredients_parent_id" ON "ingredients" USING btree ("parent_id");