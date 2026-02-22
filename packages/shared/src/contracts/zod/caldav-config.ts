import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { userCaldavConfig } from "@/server/db/schema";

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
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Input for saving config (before encryption)
export const SaveCaldavConfigInputSchema = z.object({
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
