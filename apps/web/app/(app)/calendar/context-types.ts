import type { CalendarData } from "@/hooks/calendar";
import type { ReactNode } from "react";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

export type CalendarDateRange = {
  start: Date;
  end: Date;
};

export type CalendarContextValue = {
  plannedItemsByDate: CalendarData;
  isLoading: boolean;
  isLoadingMore: boolean;
  dateRange: CalendarDateRange;
  planMeal: (date: string, slot: Slot, recipeId: string) => void;
  planNote: (date: string, slot: Slot, title: string) => void;
  deletePlanned: (id: string) => void;
  moveItem: (itemId: string, targetDate: string, targetSlot: Slot, targetIndex: number) => void;
  updateItem: (itemId: string, title: string) => void;
  getItemsForSlot: (date: string, slot: Slot) => PlannedItemFromQuery[];
  expandRange: (direction: "past" | "future") => void;
  isDateInRange: (date: Date) => boolean;
};

export type CalendarContextProviderProps = {
  children: ReactNode;
  /** Initial range mode - desktop loads current week, mobile loads +/-2 weeks */
  mode?: "desktop" | "mobile";
};
