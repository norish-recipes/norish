ALTER TABLE "ingredients" ADD COLUMN "parent_chosen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "off_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_ingredients_off_id" ON "ingredients" USING btree ("off_id");