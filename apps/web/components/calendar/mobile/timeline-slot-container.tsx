"use client";

import { memo } from "react";

import type { Slot } from "@norish/shared/contracts";

import type { PlannedItemDisplay } from "./types";
import { TimelinePlannedItem } from "./timeline-planned-item";

type TimelineSlotContainerProps = {
  dateKey: string;
  slot: Slot;
  slotLabel: string;
  items: PlannedItemDisplay[];
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
};

export const TimelineSlotContainer = memo(function TimelineSlotContainer({
  slotLabel,
  items,
  onNoteClick,
  onRecipeClick,
}: TimelineSlotContainerProps) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="text-default-500 text-xs font-medium">{slotLabel}</span>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <TimelinePlannedItem
            key={item.id}
            item={item}
            onNoteClick={onNoteClick}
            onRecipeClick={onRecipeClick}
          />
        ))}
      </div>
    </div>
  );
});
