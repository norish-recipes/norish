import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";
import { ingredientAIChanges } from "./ingredient-ai-changes";

/**
 * The junk pile (CONTEXT.md): folds of texts that name no food, which the resolver drops from a
 * name. `aiChangeId` is the AI Change that put one here, for its Undo; null for a person or the seed.
 * `householdId` is the household that marked it, null for the seed's (ADR-0042).
 */
export const ingredientJunkPile = pgTable(
  "ingredient_junk_pile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
    fold: text("fold").notNull(),
    reason: text("reason").notNull(),
    aiChangeId: uuid("ai_change_id").references(() => ingredientAIChanges.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uqidx_ingredient_junk_pile_household_fold")
      .on(t.householdId, t.fold)
      .where(sql`${t.householdId} is not null`),
    uniqueIndex("uqidx_ingredient_junk_pile_seed_fold")
      .on(t.fold)
      .where(sql`${t.householdId} is null`),
  ]
);
