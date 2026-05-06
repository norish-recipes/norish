"use client";

import type { PlannedItemDisplay } from "@/components/calendar/mobile/types";

import { PlannedItemContent } from "@/components/calendar/mobile/planned-item-content";

type DesktopDragOverlayProps = {
  item: PlannedItemDisplay;
};

export function DesktopDragOverlay({ item }: DesktopDragOverlayProps) {
  return (
    <PlannedItemContent
      className="bg-content1 ring-primary/30 w-80 rounded-xl px-3 py-2.5 shadow-xl ring-2"
      item={item}
    />
  );
}
