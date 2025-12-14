import type { UserCaldavConfigWithoutPasswordDto } from "@/types";

import { z } from "zod";

export type CaldavItemType = "recipe" | "note";
export type CaldavSyncStatus = "pending" | "synced" | "failed" | "removed";

export type CaldavSubscriptionEvents = {
  configSaved: { config: UserCaldavConfigWithoutPasswordDto | null };
  syncStarted: { timestamp: string };
  syncCompleted: { itemId: string; caldavEventUid: string };
  syncFailed: { itemId: string; errorMessage: string; retryCount: number };
  itemStatusUpdated: {
    itemId: string;
    itemType: CaldavItemType;
    syncStatus: CaldavSyncStatus;
    errorMessage: string | null;
    caldavEventUid: string | null;
  };
  initialSyncComplete: { timestamp: string; totalSynced: number; totalFailed: number };
};

export const SaveCaldavConfigInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().optional(),
  enabled: z.boolean(),
  breakfastTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  lunchTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  dinnerTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  snackTime: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
});

export const TestCaldavConnectionInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const DeleteCaldavConfigInputSchema = z.object({
  deleteEvents: z.boolean().default(false),
});

export const GetSyncStatusInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  statusFilter: z.enum(["pending", "synced", "failed", "removed"]).optional(),
});

export type SaveCaldavConfigInput = z.infer<typeof SaveCaldavConfigInputSchema>;
export type TestCaldavConnectionInput = z.infer<typeof TestCaldavConnectionInputSchema>;
export type DeleteCaldavConfigInput = z.infer<typeof DeleteCaldavConfigInputSchema>;
export type GetSyncStatusInput = z.infer<typeof GetSyncStatusInputSchema>;
