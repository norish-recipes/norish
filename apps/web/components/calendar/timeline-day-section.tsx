"use client";

import { memo } from "react";
import { useDaySlots } from "@/components/calendar/use-day-slots";
import { SlotDropdown } from "@/components/shared/slot-dropdown";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button, Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

import { TimelineSlotContainer } from "./timeline-slot-container";

type TimelineDaySectionProps = {
  date: Date;
  dateKey: string;
  isDragOver?: boolean;
  isToday: boolean;
  items: PlannedItemFromQuery[];
  dateFormatter: Intl.DateTimeFormat;
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemFromQuery) => void;
  onRecipeClick?: (item: PlannedItemFromQuery) => void;
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
  const { setNodeRef, isOver, slots } = useDaySlots(dateKey, items);
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
              {slots.map(({ slot, label, items: slotItems }) => (
                <TimelineSlotContainer
                  key={slot}
                  items={slotItems}
                  slotLabel={label}
                  onNoteClick={onNoteClick}
                  onRecipeClick={onRecipeClick}
                />
              ))}
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
});
