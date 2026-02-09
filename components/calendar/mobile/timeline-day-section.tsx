"use client";

import type { Slot } from "@/types";
import type { PlannedItemDisplay } from "./types";

import { PlusIcon } from "@heroicons/react/16/solid";
import {
  Dropdown,
  DropdownTrigger,
  Button,
  DropdownMenu,
  DropdownItem,
  Card,
  CardBody,
  Divider,
} from "@heroui/react";
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { memo, useMemo } from "react";

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
      grouped[item.slot].push(item);
    }

    // Sort by sortOrder within each slot
    for (const slot of SLOTS) {
      grouped[slot].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return grouped;
  }, [items]);

  const hasItems = items.length > 0;

  const showDragHighlight = isDragOver || isOver;

  return (
    <Card
      ref={setNodeRef}
      className={`transition-all duration-200 ${showDragHighlight ? "ring-primary ring-2" : ""} ${isToday ? "ring-primary/50 shadow-md ring-2" : ""}`}
      shadow={isToday ? "md" : "sm"}
    >
      <CardBody className="flex flex-col gap-2 px-4 py-3">
        {/* Day header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            {isToday ? (
              <>
                <span className="text-primary text-lg font-bold">{tMobile("today")}</span>
                <span className="text-default-500 text-sm">
                  {weekdayFormatter.format(date)}, {monthFormatter.format(date)} {date.getDate()}
                </span>
              </>
            ) : (
              <>
                <span className="text-foreground text-base font-semibold">
                  {monthFormatter.format(date)} {date.getDate()}
                </span>
                <span className="text-default-400 text-sm">{weekdayFormatter.format(date)}</span>
              </>
            )}
          </div>

          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                aria-label={t("addItem")}
                className="bg-default-100 text-default-500 hover:text-primary h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95"
                size="sm"
                variant="flat"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={tSlots("chooseSlot")}
              onAction={(slot) => onAddItem(dateKey, slot as Slot)}
            >
              <DropdownItem key="Breakfast">{slotLabels.Breakfast}</DropdownItem>
              <DropdownItem key="Lunch">{slotLabels.Lunch}</DropdownItem>
              <DropdownItem key="Dinner">{slotLabels.Dinner}</DropdownItem>
              <DropdownItem key="Snack">{slotLabels.Snack}</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <Divider />

        {/* Slot containers */}
        {hasItems ? (
          <div className="flex flex-col">
            {SLOTS.map((slot) => {
              const slotItems = itemsBySlot[slot];

              if (slotItems.length === 0) return null;

              return (
                <TimelineSlotContainer
                  key={slot}
                  dateKey={dateKey}
                  items={slotItems}
                  slot={slot}
                  slotLabel={slotLabels[slot]}
                  onNoteClick={onNoteClick}
                  onRecipeClick={onRecipeClick}
                />
              );
            })}
          </div>
        ) : (
          <span className="text-default-400 py-1 text-xs italic">{t("noItems")}</span>
        )}
      </CardBody>
    </Card>
  );
});
