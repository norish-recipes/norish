"use client";

import { memo, useMemo } from "react";
import { SlotDropdown } from "@/components/shared/slot-dropdown";
import { useDroppable } from "@dnd-kit/core";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button, Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { Slot } from "@norish/shared/contracts";

import type { PlannedItemDisplay } from "./types";
import { TimelineSlotContainer } from "./timeline-slot-container";
import { SLOTS } from "./types";

type TimelineDaySectionProps = {
  date: Date;
  dateKey: string;
  isDragOver?: boolean;
  isToday: boolean;
  items: PlannedItemDisplay[];
  dateFormatter: Intl.DateTimeFormat;
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
  /** On a panel the card takes the panel's secondary surface, flat, instead of the page's. */
  inPanel?: boolean;
};
export const TimelineDaySection = memo(function TimelineDaySection({
  date,
  dateKey,
  isDragOver = false,
  isToday,
  items,
  dateFormatter,
  onAddItem,
  onNoteClick,
  onRecipeClick,
  inPanel = false,
}: TimelineDaySectionProps) {
  const t = useTranslations("calendar.timeline");
  const tMobile = useTranslations("calendar.mobile");
  const tSlots = useTranslations("common.slots");

  // Make the entire day section a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: `${dateKey}_drop`,
    data: {
      type: "day",
      dateKey,
    },
  });
  const slotLabels: Record<Slot, string> = useMemo(
    () => ({
      Breakfast: tSlots("breakfast"),
      Lunch: tSlots("lunch"),
      Dinner: tSlots("dinner"),
      Snack: tSlots("snack"),
    }),
    [tSlots]
  );

  // Group items by slot
  const itemsBySlot = useMemo(() => {
    const grouped: Record<Slot, PlannedItemDisplay[]> = {
      Breakfast: [],
      Lunch: [],
      Dinner: [],
      Snack: [],
    };
    for (const item of items) {
      const slotItems = grouped[item.slot as Slot];
      if (slotItems) {
        slotItems.push(item);
      }
    }

    // Sort by sortOrder within each slot
    for (const slot of SLOTS) {
      grouped[slot]?.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  }, [items]);
  const hasItems = items.length > 0;
  const showDragHighlight = isDragOver || isOver;
  return (
    <Card
      ref={setNodeRef}
      className={`p-3 transition-all duration-200 ${inPanel ? "shadow-none" : isToday ? "shadow-md" : "shadow-sm"} ${showDragHighlight ? "ring-accent ring-2" : ""} ${isToday ? "ring-accent/50 ring-2" : ""}`}
      variant={inPanel ? "secondary" : "default"}
    >
      <Card.Content className="flex flex-col gap-2 p-0">
        {/* Day header: the date on one line, and an empty day is nothing more */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            {isToday ? (
              <>
                <span className="text-accent shrink-0 text-base font-semibold">
                  {tMobile("today")}
                </span>
                <span className="text-muted truncate text-sm">{dateFormatter.format(date)}</span>
              </>
            ) : (
              <span className="text-foreground truncate text-base font-semibold">
                {dateFormatter.format(date)}
              </span>
            )}
          </div>

          <SlotDropdown onSelectSlot={(slot) => onAddItem(dateKey, slot)}>
            <Button
              isIconOnly
              aria-label={t("addItem")}
              className={`${inPanel ? "bg-surface" : "bg-surface-secondary"} text-muted hover:text-accent h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95`}
              size="sm"
              variant="tertiary"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </SlotDropdown>
        </div>

        {hasItems && (
          <>
            <Separator className={inPanel ? "bg-surface-tertiary" : undefined} />
            <div className="flex flex-col">
              {SLOTS.map((slot) => {
                const slotItems = itemsBySlot[slot];
                if (!slotItems || slotItems.length === 0) return null;
                return (
                  <TimelineSlotContainer
                    key={slot}
                    dateKey={dateKey}
                    items={slotItems}
                    slot={slot}
                    slotLabel={slotLabels[slot] ?? slot}
                    onNoteClick={onNoteClick}
                    onRecipeClick={onRecipeClick}
                  />
                );
              })}
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
});
