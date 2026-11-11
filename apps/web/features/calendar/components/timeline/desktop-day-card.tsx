"use client";

import { memo } from "react";
import { TimelineSlotContainer } from "@/components/calendar/timeline-slot-container";
import { useDaySlots } from "@/components/calendar/use-day-slots";
import { SlotDropdown } from "@/components/shared/slot-dropdown";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button, Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";

type DesktopDayCardProps = {
  date: Date;
  dateKey: string;
  isDragOver?: boolean;
  isToday: boolean;
  items: PlannedItemFromQuery[];
  weekdayFormatter: Intl.DateTimeFormat;
  monthFormatter: Intl.DateTimeFormat;
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemFromQuery) => void;
  onRecipeClick?: (item: PlannedItemFromQuery) => void;
};
const CARD_HEIGHT = 400;

export const DesktopDayCard = memo(function DesktopDayCard({
  date,
  dateKey,
  isDragOver = false,
  isToday,
  items,
  weekdayFormatter,
  monthFormatter,
  onAddItem,
  onNoteClick,
  onRecipeClick,
}: DesktopDayCardProps) {
  const t = useTranslations("calendar.timeline");
  const tMobile = useTranslations("calendar.mobile");
  const { setNodeRef, isOver, slots } = useDaySlots(dateKey, items);
  const hasItems = items.length > 0;
  const showDragHighlight = isDragOver || isOver;

  return (
    <Card
      ref={setNodeRef}
      className={`shadow-sm transition-all duration-200 ${showDragHighlight ? "ring-accent ring-2" : ""} ${isToday ? "ring-accent/50 shadow-md ring-2" : ""}`}
      style={{
        height: CARD_HEIGHT,
      }}
    >
      <Card.Content className="flex flex-col gap-2 overflow-hidden px-4 py-3">
        {/* Day header - fixed */}
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="flex flex-col">
            {isToday ? (
              <>
                <span className="text-accent text-lg font-bold">{tMobile("today")}</span>
                <span className="text-muted text-sm">
                  {weekdayFormatter.format(date)}, {monthFormatter.format(date)} {date.getDate()}
                </span>
              </>
            ) : (
              <>
                <span className="text-foreground text-base font-semibold">
                  {monthFormatter.format(date)} {date.getDate()}
                </span>
                <span className="text-muted text-sm">{weekdayFormatter.format(date)}</span>
              </>
            )}
          </div>

          <SlotDropdown onSelectSlot={(slot) => onAddItem(dateKey, slot)}>
            <Button
              isIconOnly
              aria-label={t("addItem")}
              className="bg-surface-secondary text-muted hover:text-accent h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95"
              size="sm"
              variant="tertiary"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </SlotDropdown>
        </div>

        <Separator className="shrink-0" />

        {/* Scrollable content area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {hasItems ? (
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
          ) : (
            <span className="text-muted py-1 text-xs italic">{t("noItems")}</span>
          )}
        </div>
      </Card.Content>
    </Card>
  );
});
