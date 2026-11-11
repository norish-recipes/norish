"use client";

import type { PlannedItemDisplay } from "@/components/calendar/types";
import { PlannedItemContent } from "@/components/calendar/planned-item-content";

type TimelineDragOverlayProps = {
  item: PlannedItemDisplay;
};

export function TimelineDragOverlay({ item }: TimelineDragOverlayProps) {
  return (
    <PlannedItemContent
      className="bg-surface ring-accent/30 w-[calc(100vw-48px)] rounded-xl px-3 py-2.5 shadow-xl ring-2"
      item={item}
    />
  );
}
