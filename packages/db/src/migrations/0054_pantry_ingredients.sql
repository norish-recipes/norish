CREATE TABLE "pantry_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_pantry_ingredients_user_ingredient" UNIQUE("user_id","ingredient_id")
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "normalized_name" text;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "pantry_ingredients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "pantry_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pantry_ingredients_user_id" ON "pantry_ingredients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pantry_ingredients_ingredient_id" ON "pantry_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_ingredients_normalized_name" ON "ingredients" USING btree ("normalized_name");