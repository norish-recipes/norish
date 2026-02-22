import type { Slot } from "@norish/shared/contracts";

export type PlannedItemWithRecipePayload =
  import("@norish/shared/contracts/zod").PlannedItemWithRecipePayload;
export type SlotItemSortUpdate = import("@norish/shared/contracts/zod").SlotItemSortUpdate;

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
