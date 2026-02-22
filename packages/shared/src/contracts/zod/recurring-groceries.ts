import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

import { recurringGroceries } from "@/server/db/schema";

export const RecurringGrocerySelectBaseSchema = createSelectSchema(recurringGroceries)
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    amount: z.coerce.number().nullable(),
  });

export const RecurringGroceryInsertBaseSchema = createInsertSchema(recurringGroceries)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    amount: z.coerce.number().nullable(),
    recurrenceRule: z.enum(["day", "week", "month"]),
  });

export const RecurringGroceryUpdateBaseSchema = z.object({
  id: z.uuid(),
  name: z.string().optional(),
  unit: z.string().nullable().optional(),
  amount: z.coerce.number().nullable().optional(),
  recurrenceRule: z.enum(["day", "week", "month"]).optional(),
  recurrenceInterval: z.number().optional(),
  recurrenceWeekday: z.number().nullable().optional(),
  nextPlannedFor: z.string().optional(),
  lastCheckedDate: z.string().nullable().optional(),
  userId: z.string().optional(),
});

// Create schema without userId
export const RecurringGroceryCreateSchema = z.object({
  name: z.string(),
  unit: z.string().nullable(),
  amount: z.coerce.number().nullable(),
  recurrenceRule: z.enum(["day", "week", "month"]),
  recurrenceInterval: z.number().min(1).default(1),
  recurrenceWeekday: z.number().nullable(),
  nextPlannedFor: z.string(),
});
