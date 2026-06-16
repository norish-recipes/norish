import type { z } from "zod";

import type {
  CaldavSyncStatusInsertSchema,
  CaldavSyncStatusSelectSchema,
  CaldavSyncStatusUpdateSchema,
  CaldavSyncStatusViewSchema,
} from "@norish/shared/contracts/zod/caldav-sync-status";

import type { caldavItemTypes, caldavSyncStatuses } from "../constants/caldav";

export type CaldavSyncStatusDto = z.output<typeof CaldavSyncStatusSelectSchema>;
export type CaldavSyncStatusInsertDto = z.input<typeof CaldavSyncStatusInsertSchema>;
export type CaldavSyncStatusUpdateDto = z.input<typeof CaldavSyncStatusUpdateSchema>;
export type CaldavSyncStatusViewDto = z.output<typeof CaldavSyncStatusViewSchema>;

export type CaldavItemType = (typeof caldavItemTypes)[number];
export type CaldavSyncStatus = (typeof caldavSyncStatuses)[number];

export interface CaldavSyncStatusSummaryDto {
  pending: number;
  synced: number;
  failed: number;
  removed: number;
}
