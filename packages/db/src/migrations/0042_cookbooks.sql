CREATE TABLE "cookbook_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cookbook_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_cookbook_recipes_cookbook_recipe" UNIQUE("cookbook_id","recipe_id")
);
--> statement-breakpoint
CREATE TABLE "cookbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cookbook_recipes" ADD CONSTRAINT "cookbook_recipes_cookbook_id_cookbooks_id_fk" FOREIGN KEY ("cookbook_id") REFERENCES "public"."cookbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookbook_recipes" ADD CONSTRAINT "cookbook_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookbooks" ADD CONSTRAINT "cookbooks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cookbook_recipes_cookbook_id" ON "cookbook_recipes" USING btree ("cookbook_id");--> statement-breakpoint
CREATE INDEX "idx_cookbook_recipes_recipe_id" ON "cookbook_recipes" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_cookbooks_user_id" ON "cookbooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cookbooks_title" ON "cookbooks" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_cookbooks_created_at_desc" ON "cookbooks" USING btree ("created_at" DESC NULLS LAST);