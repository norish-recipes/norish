import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { ingredientAIChanges } from "./ingredient-ai-changes";

/**
 * The junk pile (CONTEXT.md): folds of texts that name no food, which the resolver drops from a
 * name. `aiChangeId` is the AI Change that put one here, for its Undo; null for a person or the seed.
 */
export const ingredientJunkPile = pgTable(
  "ingredient_junk_pile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fold: text("fold").notNull(),
    reason: text("reason").notNull(),
    aiChangeId: uuid("ai_change_id").references(() => ingredientAIChanges.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uqidx_ingredient_junk_pile_fold").on(t.fold)]
);
