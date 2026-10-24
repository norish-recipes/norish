-- The junk pile: folds of texts that name no food, which the resolver drops from a name
-- (ingredient-cleanup 47); an AI Change that put one there takes it off with its Undo.
CREATE TABLE "ingredient_junk_pile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fold" text NOT NULL,
	"reason" text NOT NULL,
	"ai_change_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_junk_pile" ADD CONSTRAINT "ingredient_junk_pile_ai_change_id_ingredient_ai_changes_id_fk" FOREIGN KEY ("ai_change_id") REFERENCES "public"."ingredient_ai_changes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uqidx_ingredient_junk_pile_fold" ON "ingredient_junk_pile" USING btree ("fold");