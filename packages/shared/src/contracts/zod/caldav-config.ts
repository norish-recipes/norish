import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { userCaldavConfig } from "@norish/db/schema";

export const UserCaldavConfigSelectSchema = createSelectSchema(userCaldavConfig);

export const UserCaldavConfigInsertSchema = createInsertSchema(userCaldavConfig).omit({
  createdAt: true,
  updatedAt: true,
});

export const UserCaldavConfigUpdateSchema = createUpdateSchema(userCaldavConfig).omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Decrypted config for client display
export const UserCaldavConfigDecryptedSchema = z.object({
  userId: z.string(),
  serverUrl: z.string().url(),
  calendarUrl: z.string().url().optional().nullable(),
  username: z.string(),
  password: z.string(),
  enabled: z.boolean(),
  breakfastTime: z.string(),
  lunchTime: z.string(),
  dinnerTime: z.string(),
  snackTime: z.string(),
  version: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserCaldavConfigWithoutPasswordSchema = UserCaldavConfigDecryptedSchema.omit({
  password: true,
});

// Input for saving config (before encryption)
export const SaveCaldavConfigInputSchema = z.object({
  version: z.number().int().positive().optional(),
  serverUrl: z.string().url(),
  calendarUrl: z.string().url().optional().nullable(),
  username: z.string().min(1),
  password: z.string().min(1),
  enabled: z.boolean(),
  breakfastTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  lunchTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  dinnerTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  snackTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
});

export const DeleteCaldavConfigInputSchema = z.object({
  version: z.number().int().positive().optional(),
  deleteEvents: z.boolean().default(false),
});

export const CaldavConfigSavedEventSchema = z.object({
  config: UserCaldavConfigWithoutPasswordSchema.nullable(),
});

export const CaldavSyncStartedEventSchema = z.object({
  timestamp: z.string(),
});

export const CaldavSyncCompletedEventSchema = z.object({
  itemId: z.string(),
  caldavEventUid: z.string(),
});

export const CaldavSyncFailedEventSchema = z.object({
  itemId: z.string(),
  errorMessage: z.string(),
  retryCount: z.number().int(),
});

export const CaldavItemStatusUpdatedEventSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(["recipe", "note"]),
  syncStatus: z.enum(["pending", "synced", "failed", "removed"]),
  errorMessage: z.string().nullable(),
  caldavEventUid: z.string().nullable(),
  version: z.number().int().positive(),
});

export const CaldavInitialSyncCompleteEventSchema = z.object({
  timestamp: z.string(),
  totalSynced: z.number().int(),
  totalFailed: z.number().int(),
});
