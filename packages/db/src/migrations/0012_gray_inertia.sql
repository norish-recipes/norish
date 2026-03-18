ALTER TABLE "recipes" DROP CONSTRAINT "uq_recipes_url";--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "uq_recipes_url_user" UNIQUE("url","user_id");