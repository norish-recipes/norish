import { z } from "zod";

import {
  CaldavConfigSavedEventSchema,
  CaldavInitialSyncCompleteEventSchema,
  CaldavItemStatusUpdatedEventSchema,
  CaldavSyncCompletedEventSchema,
  CaldavSyncFailedEventSchema,
  CaldavSyncStartedEventSchema,
  DeleteCaldavConfigInputSchema as SharedDeleteCaldavConfigInputSchema,
  SaveCaldavConfigInputSchema as SharedSaveCaldavConfigInputSchema,
} from "@norish/shared/contracts/zod";

export type CaldavItemType = "recipe" | "note";
export type CaldavSyncStatus = "pending" | "synced" | "failed" | "removed";

export type CaldavSubscriptionEvents = {
  configSaved: z.infer<typeof CaldavConfigSavedEventSchema>;
  syncStarted: z.infer<typeof CaldavSyncStartedEventSchema>;
  syncCompleted: z.infer<typeof CaldavSyncCompletedEventSchema>;
  syncFailed: z.infer<typeof CaldavSyncFailedEventSchema>;
  itemStatusUpdated: z.infer<typeof CaldavItemStatusUpdatedEventSchema>;
  initialSyncComplete: z.infer<typeof CaldavInitialSyncCompleteEventSchema>;
};

export const SaveCaldavConfigInputSchema = SharedSaveCaldavConfigInputSchema.extend({
  password: z.string().optional(),
});

export const TestCaldavConnectionInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const DeleteCaldavConfigInputSchema = SharedDeleteCaldavConfigInputSchema;

export const GetSyncStatusInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  statusFilter: z.enum(["pending", "synced", "failed", "removed"]).optional(),
});

export const FetchCalendarsInputSchema = z.object({
  serverUrl: z.url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export type SaveCaldavConfigInput = z.infer<typeof SaveCaldavConfigInputSchema>;
export type TestCaldavConnectionInput = z.infer<typeof TestCaldavConnectionInputSchema>;
export type DeleteCaldavConfigInput = z.infer<typeof DeleteCaldavConfigInputSchema>;
export type GetSyncStatusInput = z.infer<typeof GetSyncStatusInputSchema>;
export type FetchCalendarsInput = z.infer<typeof FetchCalendarsInputSchema>;
