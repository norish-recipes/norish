import type { Slot } from "@/types";

export type PlannedItemWithRecipePayload =
  import("@/server/db/zodSchemas").PlannedItemWithRecipePayload;
export type SlotItemSortUpdate = import("@/server/db/zodSchemas").SlotItemSortUpdate;

export type PlannedItemType = "recipe" | "note";

export type CalendarSubscriptionEvents = {
  failed: { reason: string };

  itemCreated: { item: PlannedItemWithRecipePayload };
  itemDeleted: { itemId: string; date: string; slot: Slot };
  itemMoved: {
    item: PlannedItemWithRecipePayload;
    targetSlotItems: SlotItemSortUpdate[];
    sourceSlotItems: SlotItemSortUpdate[] | null;
    oldDate: string;
    oldSlot: Slot;
    oldSortOrder: number;
  };
  itemUpdated: { item: PlannedItemWithRecipePayload };
};
