CREATE TABLE "recipe_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"video" text NOT NULL,
	"thumbnail" text,
	"duration" numeric,
	"order" numeric DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_videos" ADD CONSTRAINT "recipe_videos_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_videos_recipe_id" ON "recipe_videos" USING btree ("recipe_id");