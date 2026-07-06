import type { QueryKey } from "@tanstack/react-query";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export type CalendarData = Record<string, PlannedItemFromQuery[]>;

export type CalendarCacheHelpers = {
  setCalendarData: (
    updater: (prev: PlannedItemFromQuery[] | undefined) => PlannedItemFromQuery[] | undefined
  ) => void;
  invalidate: () => void;
};

export type CalendarQueryResult = {
  items: PlannedItemFromQuery[];
  calendarData: CalendarData;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setCalendarData: (updater: (prev: CalendarData) => CalendarData) => void;
  invalidate: () => void;
};

export type CalendarMutationsResult = {
  createItem: (
    date: string,
    slot: Slot,
    itemType: "recipe" | "note",
    recipeId?: string,
    title?: string
  ) => void;
  deleteItem: (itemId: string) => void;
  moveItem: (itemId: string, targetDate: string, targetSlot: Slot, targetIndex: number) => void;
  updateItem: (itemId: string, title: string) => void;
  isCreating: boolean;
  isDeleting: boolean;
  isMoving: boolean;
  isUpdating: boolean;
};

export interface CreateCalendarHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
