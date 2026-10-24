-- AI deletes a food that is not a food as an AI Change (ADR-0037): the change has no food to list
-- under.
ALTER TABLE "ingredient_ai_changes" ALTER COLUMN "ingredient_id" DROP NOT NULL;
