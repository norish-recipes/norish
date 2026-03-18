
DO $$ BEGIN
	CREATE TYPE "measurement_system" AS ENUM ('metric', 'us', 'imperial');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "slot_type" AS ENUM ('Breakfast', 'Lunch', 'Dinner', 'Snack');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;


CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token_enc" text,
	"access_token_enc" text,
	"id_token_enc" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionTokenHash" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email_enc" text,
	"name_enc" text,
	"image_enc" text,
	"email_hmac" text,
	"name_hmac" text,
	"image_hmac" text,
	"emailVerified" timestamp
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groceries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_ingredient_id" uuid,
	"name" text,
	"unit" text,
	"amount" numeric(10, 3),
	"is_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_users" (
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_household_users" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"join_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_households_join_code" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"description" text,
	"image" text,
	"url" text,
	"servings" integer DEFAULT 1 NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"total_minutes" integer,
	"system_used" "measurement_system" DEFAULT 'metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_recipes_url" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_tags" (
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_recipe_tags" PRIMARY KEY("recipe_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"amount" numeric(10, 3),
	"unit" text,
	"order" numeric,
	"system_used" "measurement_system" DEFAULT 'metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"step" text NOT NULL,
	"system_used" "measurement_system" DEFAULT 'metric' NOT NULL,
	"order" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"date" date NOT NULL,
	"slot" "slot_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groceries" ADD CONSTRAINT "groceries_recipe_ingredient_id_recipe_ingredients_id_fk" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "public"."recipe_ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_users" ADD CONSTRAINT "household_users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_users" ADD CONSTRAINT "household_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_recipes" ADD CONSTRAINT "planned_recipes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_recipes" ADD CONSTRAINT "planned_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_user_provider_unique" ON "account" USING btree ("userId","provider","providerAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_hmac_idx" ON "user" USING btree ("email_hmac");--> statement-breakpoint
CREATE INDEX "idx_groceries_user_id" ON "groceries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_groceries_recipe_ingredient_id" ON "groceries" USING btree ("recipe_ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_groceries_is_done" ON "groceries" USING btree ("is_done");--> statement-breakpoint
CREATE INDEX "idx_household_users_household_id" ON "household_users" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_household_users_user_id" ON "household_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_households_name" ON "households" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_households_created_at" ON "households" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_recipes_user_id" ON "recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipes_name" ON "recipes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_recipes_created_at_desc" ON "recipes" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_recipes_total_minutes" ON "recipes" USING btree ("total_minutes");--> statement-breakpoint
CREATE INDEX "idx_recipes_prep_minutes" ON "recipes" USING btree ("prep_minutes");--> statement-breakpoint
CREATE INDEX "idx_recipes_cook_minutes" ON "recipes" USING btree ("cook_minutes");--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_tags_name_lower" ON "tags" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_tags_created_at" ON "tags" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_ingredients_name_lower" ON "ingredients" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_ingredients_created_at" ON "ingredients" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_recipe_tags_recipe_id" ON "recipe_tags" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_tags_tag_id" ON "recipe_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_recipe_id" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_ingredients_ingredient_id" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_steps_recipe_id" ON "steps" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_recipe_step_system" ON "steps" USING btree ("recipe_id","step","system_used");--> statement-breakpoint
CREATE INDEX "idx_planned_recipes_user_date" ON "planned_recipes" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_planned_recipes_user" ON "planned_recipes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_planned_recipes_recipe" ON "planned_recipes" USING btree ("recipe_id");