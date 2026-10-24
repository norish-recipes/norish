CREATE TABLE IF NOT EXISTS "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"fold" text NOT NULL,
	"equipment_id" uuid NOT NULL,
	"owner_id" text,
	"seeded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"equipment_alias_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment" ADD CONSTRAINT "equipment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_aliases" ADD CONSTRAINT "equipment_aliases_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_aliases" ADD CONSTRAINT "equipment_aliases_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_equipment" ADD CONSTRAINT "recipe_equipment_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recipe_equipment" ADD CONSTRAINT "recipe_equipment_equipment_alias_id_equipment_aliases_id_fk" FOREIGN KEY ("equipment_alias_id") REFERENCES "public"."equipment_aliases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_equipment_name_lower" ON "equipment" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_equipment_created_at" ON "equipment" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uqidx_equipment_aliases_fold" ON "equipment_aliases" USING btree ("fold");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_equipment_aliases_equipment_id" ON "equipment_aliases" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_equipment_recipe_id" ON "recipe_equipment" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recipe_equipment_equipment_alias_id" ON "recipe_equipment" USING btree ("equipment_alias_id");


