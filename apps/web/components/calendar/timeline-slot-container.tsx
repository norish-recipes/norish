"use client";

import { memo } from "react";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import { TimelinePlannedItem } from "./timeline-planned-item";

type TimelineSlotContainerProps = {
  slotLabel: string;
  items: PlannedItemFromQuery[];
  onNoteClick?: (item: PlannedItemFromQuery) => void;
  onRecipeClick?: (item: PlannedItemFromQuery) => void;
};

export const TimelineSlotContainer = memo(function TimelineSlotContainer({
  slotLabel,
  items,
  onNoteClick,
  onRecipeClick,
}: TimelineSlotContainerProps) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="text-muted text-xs font-medium">{slotLabel}</span>
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
