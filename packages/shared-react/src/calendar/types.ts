import type { QueryKey } from "@tanstack/react-query";

import type {
  CaldavSyncStatusSummaryDto,
  CaldavSyncStatusViewDto,
  ConnectionTestResult,
  PlannedItemFromQuery,
  Slot,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";
import type { CalendarRange } from "@norish/shared/lib/helpers";

export type CalendarData = Record<string, PlannedItemFromQuery[]>;

/** A cached `calendar.listItems` range that holds data, with its key. */
export type CachedCalendarRange = {
  key: QueryKey;
  range: CalendarRange;
  items: PlannedItemFromQuery[];
};

export type CalendarCacheHelpers = {
  cachedRanges: () => CachedCalendarRange[];
  /** Place an item, by its date, in every cached range — a no-op where it already is. */
  upsertItemAcrossRanges: (item: PlannedItemWithRecipePayload) => void;
  /** Drop an item from every cached range. */
  removeItemAcrossRanges: (itemId: string) => void;
  /** Land a housemate's move in every cached range. */
  applyMoveEchoAcrossRanges: (payload: PayloadOf<CalendarRealtime, "itemMoved">) => void;
  /** Write one range, keeping it invalidated when it was. */
  writeRange: (key: QueryKey, items: PlannedItemFromQuery[]) => void;
  /** Reread every range once no write is pending. */
  rereadAllRanges: () => void;
};

export type CalendarQueryResult = {
  calendarData: CalendarData;
  isLoading: boolean;
};

export type CalendarMutationsResult = {
  planRecipe: (date: string, slot: Slot, recipeId: string) => void;
  planNote: (date: string, slot: Slot, title: string) => void;
  deleteItem: (itemId: string) => void;
  moveItem: (itemId: string, targetDate: string, targetSlot: Slot, targetIndex: number) => void;
  updateItem: (itemId: string, title: string) => void;
};

type CaldavSyncStatusPage = {
  statuses: CaldavSyncStatusViewDto[];
  total: number;
  page: number;
  pageSize: number;
};

type CaldavConfigUpdater = (
  prev: UserCaldavConfigWithoutPasswordDto | null | undefined
) => UserCaldavConfigWithoutPasswordDto | null | undefined;

export type CaldavConfigQueryResult = {
  config: UserCaldavConfigWithoutPasswordDto | null;
  error: unknown;
  isLoading: boolean;
};

export type CaldavSyncStatusQueryResult = {
  statuses: CaldavSyncStatusViewDto[];
  total: number;
  page: number;
  pageSize: number;
  error: unknown;
  isLoading: boolean;
};

export type CaldavSummaryQueryResult = {
  summary: CaldavSyncStatusSummaryDto;
  error: unknown;
  isLoading: boolean;
};

export type CaldavCacheHelpers = {
  cachedConfigVersion: () => number | undefined;
  setConfig: (updater: CaldavConfigUpdater) => void;
  setStatuses: (
    updater: (prev: CaldavSyncStatusPage | undefined) => CaldavSyncStatusPage | undefined
  ) => void;
  invalidateConfig: () => void;
  invalidateSyncStatus: () => void;
  invalidateSummary: () => void;
  invalidateConnection: () => void;
};

export type SaveCaldavConfigInput = {
  version?: number;
  serverUrl: string;
  calendarUrl?: string | null;
  username: string;
  password: string;
  trustedCertificate?: string | null;
  enabled: boolean;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  snackTime: string;
};

export type TestConnectionInput = {
  serverUrl: string;
  username: string;
  password: string;
  trustedCertificate?: string | null;
};

/** Each write's failure is shown to the reader through the platform; the caller only learns the outcome. */
export type CaldavMutationsResult = {
  /** Resolves whether the config was saved. */
  saveConfig: (input: SaveCaldavConfigInput) => Promise<boolean>;
  /** A request that fails answers as a failed test. */
  testConnection: (input: TestConnectionInput) => Promise<ConnectionTestResult>;
  /** Resolves whether the config was deleted. */
  deleteConfig: (deleteEvents?: boolean) => Promise<boolean>;
  triggerSync: () => void;
  isSavingConfig: boolean;
  isTestingConnection: boolean;
  isTriggeringSync: boolean;
};
