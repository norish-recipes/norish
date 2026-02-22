import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { caldavSyncStatus } from "@/server/db/schema";

export const CaldavSyncStatusSelectSchema = createSelectSchema(caldavSyncStatus);

export const CaldavSyncStatusInsertSchema = createInsertSchema(caldavSyncStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CaldavSyncStatusUpdateSchema = createUpdateSchema(caldavSyncStatus).omit({
  id: true,
  userId: true,
  itemId: true,
  itemType: true,
  createdAt: true,
});

// View schema with additional data for display
export const CaldavSyncStatusViewSchema = CaldavSyncStatusSelectSchema.extend({
  recipeName: z.string().nullable().optional(),
  noteName: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  slot: z.string().nullable().optional(),
});
