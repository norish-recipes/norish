"use client";

import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Button, Card, Dropdown, Label, Separator } from "@heroui/react";
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
  weekdayFormatter: Intl.DateTimeFormat;
  monthFormatter: Intl.DateTimeFormat;
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
};
export const TimelineDaySection = memo(function TimelineDaySection({
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
      className={`shadow-sm transition-all duration-200 ${showDragHighlight ? "ring-accent ring-2" : ""} ${isToday ? "ring-accent/50 shadow-md ring-2" : ""}`}
    >
      <Card.Content className="flex flex-col gap-2 px-4 py-3">
        {/* Day header */}
        <div className="flex items-start justify-between gap-3">
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

          <Dropdown>
            <Button
              isIconOnly
              aria-label={t("addItem")}
              className="bg-surface-secondary text-muted hover:text-accent h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95"
              size="sm"
              variant="tertiary"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
            <Dropdown.Popover className="bg-overlay">
              <Dropdown.Menu
                aria-label={tSlots("chooseSlot")}
                onAction={(slot) => onAddItem(dateKey, slot as Slot)}
              >
                <Dropdown.Item key="Breakfast" id="Breakfast" textValue="Breakfast">
                  <Label>{slotLabels.Breakfast}</Label>
                </Dropdown.Item>
                <Dropdown.Item key="Lunch" id="Lunch" textValue="Lunch">
                  <Label>{slotLabels.Lunch}</Label>
                </Dropdown.Item>
                <Dropdown.Item key="Dinner" id="Dinner" textValue="Dinner">
                  <Label>{slotLabels.Dinner}</Label>
                </Dropdown.Item>
                <Dropdown.Item key="Snack" id="Snack" textValue="Snack">
                  <Label>{slotLabels.Snack}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <Separator />

        {/* Slot containers */}
        {hasItems ? (
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
        ) : (
          <span className="text-muted py-1 text-xs italic">{t("noItems")}</span>
        )}
      </Card.Content>
    </Card>
  );
});
