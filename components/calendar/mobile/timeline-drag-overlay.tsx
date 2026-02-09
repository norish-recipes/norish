"use client";

import type { PlannedItemDisplay } from "./types";

import { PlannedItemContent } from "./planned-item-content";

type TimelineDragOverlayProps = {
  item: PlannedItemDisplay;
};

export function TimelineDragOverlay({ item }: TimelineDragOverlayProps) {
  return (
    <PlannedItemContent
      className="bg-content1 ring-primary/30 w-[calc(100vw-48px)] rounded-xl px-3 py-2.5 shadow-xl ring-2"
      item={item}
    />
  );
}
