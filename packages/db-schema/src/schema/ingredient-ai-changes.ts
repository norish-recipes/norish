import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { RecipeIngredientJoin } from "./recipe-ingredients";
import { ingredients } from "./ingredients";

/** A food AI deleted, its spellings and the rows that named it, for Undo to mint it again under its ids. */
export interface DeletedFood {
  ingredientId: string;
  name: string;
  ownerId: string | null;
  parentId: string | null;
  aliases: Array<{
    id: string;
    text: string;
    fold: string;
    locale: string | null;
    ownerId: string | null;
  }>;
  lineFoods: Array<{ lineId: string; position: number; aliasId: string }>;
  groceries: Array<{ id: string; aliasId: string | null }>;
  recurring: Array<{ id: string; aliasId: string | null }>;
}

/**
 * A spelling AI took off its food or moved to another, and for a removal the rows that named it:
 * each line's foods in order, and the groceries pointing at it.
 */
export interface ChangedSpelling {
  spelling: {
    id: string;
    text: string;
    fold: string;
    locale: string | null;
    ownerId: string | null;
  };
  lines: Array<{
    id: string;
    aliasIds: string[];
    joined: RecipeIngredientJoin | null;
  }>;
  groceries: string[];
  recurring: string[];
  /** For a removal, what each row named once read again, by id; Undo skips a row changed since. */
  left?: Record<string, string[]>;
}

/** What Undo needs per kind of AI Change. */
export type AIChangeUndo =
  | {
      kind: "merge";
      name: string;
      ownerId: string | null;
      aliasIds: string[];
      parentId: string | null;
    }
  | { kind: "parent"; formerParentId: string | null }
  | { kind: "plain-name"; formerName: string; name: string }
  | { kind: "not-a-food"; food: DeletedFood }
  | ({ kind: "spelling" } & ChangedSpelling);

/**
 * AI Changes (CONTEXT.md): under `ingredientId` (naming `targetId`); a deleted food's food is in
 * `undo`. An undone row stays, so AI never makes that change again.
 */
export const ingredientAIChanges = pgTable(
  "ingredient_ai_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "cascade" }),
    targetId: uuid("target_id").references(() => ingredients.id, { onDelete: "cascade" }),
    sure: boolean("sure").notNull(),
    undo: jsonb("undo").$type<AIChangeUndo>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    keptAt: timestamp("kept_at", { withTimezone: true }),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_ingredient_ai_changes_ingredient_id").on(t.ingredientId),
    index("idx_ingredient_ai_changes_created_at").on(t.createdAt),
  ]
);
