-- A recipe whose only picture is the old single image keeps it as its first
-- gallery image. One that has a gallery already never showed the old image,
-- so it is left out rather than brought back.
INSERT INTO "recipe_images" ("recipe_id", "image", "order")
SELECT "id", "image", '0' FROM "recipes"
WHERE btrim(coalesce("image", '')) <> ''
  AND NOT EXISTS (SELECT 1 FROM "recipe_images" WHERE "recipe_images"."recipe_id" = "recipes"."id");--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "image";
