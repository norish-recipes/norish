import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";
import { steps } from "./steps";

export const stepImages = pgTable(
  "step_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stepId: uuid("step_id")
      .notNull()
      .references(() => steps.id, { onDelete: "cascade" }),
    image: text("image").notNull(),
    order: numeric("order").default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [index("idx_step_images_step_id").on(t.stepId)]
);
