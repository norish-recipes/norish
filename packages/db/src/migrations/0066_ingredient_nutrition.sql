CREATE TABLE "ingredient_nutrition_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"numbers_food" text,
	"kcal" double precision,
	"fat" double precision,
	"carbs" double precision,
	"protein" double precision,
	"piece_weight_food" text,
	"piece_weight" double precision,
	"density_food" text,
	"density" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_ingredient_nutrition_corrections_user_ingredient" UNIQUE("user_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "nutrition_foods" (
	"dataset" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kcal" double precision NOT NULL,
	"fat" double precision NOT NULL,
	"carbs" double precision NOT NULL,
	"protein" double precision NOT NULL,
	"piece_weight" double precision,
	"density" double precision,
	"ndb" text,
	CONSTRAINT "nutrition_foods_dataset_code_pk" PRIMARY KEY("dataset","code")
);
--> statement-breakpoint
CREATE TABLE "nutrition_rules" (
	"off_id" text NOT NULL,
	"kind" text NOT NULL,
	"food" text,
	CONSTRAINT "nutrition_rules_off_id_kind_pk" PRIMARY KEY("off_id","kind")
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "nutrition_codes" jsonb;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD CONSTRAINT "ingredient_nutrition_corrections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_nutrition_corrections" ADD CONSTRAINT "ingredient_nutrition_corrections_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ingredient_nutrition_corrections_ingredient_id" ON "ingredient_nutrition_corrections" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_nutrition_foods_ndb" ON "nutrition_foods" USING btree ("ndb");