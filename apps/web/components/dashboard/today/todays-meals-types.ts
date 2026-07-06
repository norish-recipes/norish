import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

export type TodayMealSlotCardProps = {
  slot: Slot;
  slotLabel: string;
  items: PlannedItemFromQuery[];
  onPlan: (slot: Slot) => void;
};
