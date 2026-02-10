"use client";

import { ExclamationTriangleIcon, PlusIcon } from "@heroicons/react/16/solid";
import {
  Dropdown,
  DropdownTrigger,
  Button,
  DropdownMenu,
  DropdownItem,
  Divider,
} from "@heroui/react";
import { useMemo, useRef, useCallback, memo, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";

import { Slot } from "@/types";
import { startOfMonth, addMonths, endOfMonth, eachDayOfInterval, dateKey } from "@/lib/helpers";
import { useRecipeQuery } from "@/hooks/recipes";
import Panel from "@/components/Panel/Panel";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import { useCalendarQuery, useCalendarMutations, useCalendarSubscription } from "@/hooks/calendar";

const ESTIMATED_DAY_HEIGHT = 180;

type MiniCalendarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};

type PlannedItemDisplay = {
  slot: Slot;
  itemType: string;
  recipeName?: string | null;
  recipeImage?: string | null;
  title?: string | null;
  allergyWarnings?: string[] | null;
};

const DayRow = memo(function DayRow({
  date,
  dateKeyStr,
  isToday,
  items,
  weekdayLong,
  monthLong,
  onPlan,
  slotLabels,
  noItemsLabel,
  addItemLabel,
}: {
  date: Date;
  dateKeyStr: string;
  isToday: boolean;
  items: PlannedItemDisplay[];
  weekdayLong: Intl.DateTimeFormat;
  monthLong: Intl.DateTimeFormat;
  onPlan: (dayKey: string, slot: Slot) => void;
  slotLabels: Record<Slot, string>;
  noItemsLabel: string;
  addItemLabel: string;
}) {
  return (
    <div className="border-default-100 border-b last:border-none">
      <div className="bg-background hover:bg-default-50/50 flex flex-col gap-3 px-4 py-4 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
            {weekdayLong.format(date)}, {monthLong.format(date)} {date.getDate()}
          </div>

          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                aria-label={addItemLabel}
                className="bg-default-100 text-default-500 hover:text-primary h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95"
                size="sm"
                variant="flat"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Choose slot"
              onAction={(slot) => onPlan(dateKeyStr, slot as Slot)}
            >
              <DropdownItem key="Breakfast">{slotLabels.Breakfast}</DropdownItem>
              <DropdownItem key="Lunch">{slotLabels.Lunch}</DropdownItem>
              <DropdownItem key="Dinner">{slotLabels.Dinner}</DropdownItem>
              <DropdownItem key="Snack">{slotLabels.Snack}</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <Divider className="my-2" />

        <div className="flex w-full flex-col gap-2">
          {items.length === 0 ? (
            <span className="text-default-400 text-xs italic">{noItemsLabel}</span>
          ) : (
            items.map((it) => (
              <div
                key={`${dateKeyStr}-${it.slot}-${it.itemType}-${it.recipeName ?? it.title ?? ""}`}
                className="flex w-full items-start gap-3 py-1"
              >
                <PlannedItemThumbnail
                  alt={it.itemType === "recipe" ? (it.recipeName ?? "") : (it.title ?? "")}
                  image={it.recipeImage}
                  itemType={it.itemType as "recipe" | "note"}
                  size="md"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex-1 truncate text-sm font-medium ${it.itemType === "note" ? "text-default-500 italic" : "text-foreground"}`}
                      title={it.itemType === "recipe" ? (it.recipeName ?? "") : (it.title ?? "")}
                    >
                      {it.itemType === "recipe" ? it.recipeName : it.title}
                    </span>
                    {it.allergyWarnings && it.allergyWarnings.length > 0 && (
                      <ExclamationTriangleIcon className="text-warning h-4 w-4 shrink-0" />
                    )}
                  </div>
                  <span className="text-default-400 text-xs">{slotLabels[it.slot]}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

function MiniCalendarContent({
  recipeId,
  onOpenChange,
}: {
  recipeId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calendar.panel");
  const tSlots = useTranslations("common.slots");
  const tTimeline = useTranslations("calendar.timeline");
  const locale = useLocale();
  const today = useMemo(() => new Date(), []);
  const rangeStart = useMemo(() => startOfMonth(addMonths(today, -1)), [today]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(today, 1)), [today]);

  const startISO = dateKey(rangeStart);
  const endISO = dateKey(rangeEnd);

  const { recipe } = useRecipeQuery(recipeId);
  const { calendarData, isLoading } = useCalendarQuery(startISO, endISO);
  const { createItem } = useCalendarMutations(startISO, endISO);

  useCalendarSubscription(startISO, endISO);

  const allDays = useMemo(() => eachDayOfInterval(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const weekdayLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long" }), [locale]);
  const monthLong = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long" }), [locale]);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const todayIndex = useMemo(
    () => allDays.findIndex((d) => dateKey(d) === todayKey),
    [allDays, todayKey]
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  // Calculate initial offset to start at today
  const initialOffset = todayIndex >= 0 ? todayIndex * ESTIMATED_DAY_HEIGHT : 0;

  const virtualizer = useVirtualizer({
    count: allDays.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_DAY_HEIGHT,
    overscan: 3,
    getItemKey: (index) => dateKey(allDays[index]),
    initialOffset,
  });

  // Scroll to today after first render
  useEffect(() => {
    if (hasScrolledToToday || todayIndex < 0 || !parentRef.current) return;

    const timeoutId = setTimeout(() => {
      virtualizer.scrollToIndex(todayIndex, { align: "start" });
      setHasScrolledToToday(true);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [todayIndex, hasScrolledToToday, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  const slotOrder: Record<Slot, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };

  const slotLabels: Record<Slot, string> = useMemo(
    () => ({
      Breakfast: tSlots("breakfast"),
      Lunch: tSlots("lunch"),
      Dinner: tSlots("dinner"),
      Snack: tSlots("snack"),
    }),
    [tSlots]
  );

  const noItemsLabel = tTimeline("noItems");
  const addItemLabel = tTimeline("addItem");

  const handlePlan = useCallback(
    (dayKey: string, slot: Slot) => {
      if (!recipe) return;

      createItem(dayKey, slot, "recipe", recipe.id, undefined);
      onOpenChange(false);
    },
    [recipe, onOpenChange, createItem]
  );

  if (isLoading) {
    return <>Loading...</>;
  }

  if (allDays.length === 0) {
    return (
      <div className="text-default-500 flex items-center justify-center p-4 text-sm">
        {t("noDaysAvailable")}
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={parentRef} className="absolute inset-0 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const d = allDays[virtualItem.index];
            const key = dateKey(d);
            const items = (calendarData[key] ?? [])
              .sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot])
              .map((it) => ({
                slot: it.slot,
                itemType: it.itemType,
                recipeName: (it as { recipeName?: string | null }).recipeName,
                recipeImage: (it as { recipeImage?: string | null }).recipeImage,
                title: it.title,
                allergyWarnings: (it as { allergyWarnings?: string[] | null }).allergyWarnings,
              }));
            const isToday = key === todayKey;

            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <DayRow
                  addItemLabel={addItemLabel}
                  date={d}
                  dateKeyStr={key}
                  isToday={isToday}
                  items={items}
                  monthLong={monthLong}
                  noItemsLabel={noItemsLabel}
                  slotLabels={slotLabels}
                  weekdayLong={weekdayLong}
                  onPlan={handlePlan}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MiniCalendar({ open, onOpenChange, recipeId }: MiniCalendarProps) {
  const t = useTranslations("calendar.panel");

  return (
    <Panel open={open} title={t("addToCalendar")} onOpenChange={onOpenChange}>
      <div className="flex min-h-0 flex-1 flex-col">
        {open && <MiniCalendarContent recipeId={recipeId} onOpenChange={onOpenChange} />}
      </div>
    </Panel>
  );
}
