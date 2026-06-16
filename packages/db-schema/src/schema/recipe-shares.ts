import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";
import { mutableRowColumns } from "./shared";

export const recipeShares = pgTable(
  "recipe_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    ...mutableRowColumns,
  },
  (t) => [
    index("idx_recipe_shares_user_id").on(t.userId),
    index("idx_recipe_shares_recipe_id").on(t.recipeId),
    unique("uq_recipe_shares_token_hash").on(t.tokenHash),
  ]
);
