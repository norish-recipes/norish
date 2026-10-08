"use client";

import type { PlannedItemDisplay } from "@/components/calendar/mobile";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { landOnDay, settleLanding } from "@/components/calendar/land-on-day";
import { TimelineDaySection } from "@/components/calendar/mobile";
import Panel from "@/components/Panel/Panel";
import { useCalendarMutations, useCalendarQuery, useCalendarSubscription } from "@/hooks/calendar";
import { useRecipeQuery } from "@/hooks/recipes";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";
import {
  addMonths,
  dateKey,
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
} from "@norish/shared/lib/helpers";

import { useAfterPlanning } from "./after-planning";

// An empty day: its header card and the gap around it
const ESTIMATED_DAY_HEIGHT = 72;
type MiniCalendarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};
function MiniCalendarContent({
  recipeId,
  onOpenChange,
  onPlanned,
}: {
  recipeId: string;
  onOpenChange: (open: boolean) => void;
  onPlanned: (recipeId: string) => void;
}) {
  const t = useTranslations("calendar.panel");
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
  // A day's date on one line, as the calendar itself writes it: "Wed, Oct 7"
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }),
    [locale]
  );
  const todayKey = useMemo(() => dateKey(today), [today]);
  const todayIndex = useMemo(
    () => allDays.findIndex((d) => dateKey(d) === todayKey),
    [allDays, todayKey]
  );
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate initial offset to start at today
  const initialOffset = todayIndex >= 0 ? todayIndex * ESTIMATED_DAY_HEIGHT : 0;
  const virtualizer = useVirtualizer({
    count: allDays.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_DAY_HEIGHT,
    overscan: 3,
    getItemKey: (index) => {
      const day = allDays[index];
      return day ? dateKey(day) : `missing-${index}`;
    },
    initialOffset,
    // The panel opens at today's estimated offset, so the days above it are
    // measured during commit; a synchronous flush there is what React warns about.
    useFlushSync: false,
    onChange: settleLanding,
  });

  // Land on today the way the calendar itself does, once the days are drawn
  const hasLandedRef = useRef(false);

  useEffect(() => {
    if (hasLandedRef.current || isLoading || todayIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      landOnDay(virtualizer, todayIndex);
      hasLandedRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [isLoading, todayIndex, virtualizer]);
  const virtualItems = virtualizer.getVirtualItems();
  const handlePlan = useCallback(
    (dayKey: string, slot: Slot) => {
      if (!recipe) return;
      createItem(dayKey, slot, "recipe", recipe.id, undefined);
      onOpenChange(false);
      onPlanned(recipe.id);
    },
    [recipe, onOpenChange, createItem, onPlanned]
  );
  if (isLoading) {
    return <>Loading...</>;
  }
  if (allDays.length === 0) {
    return (
      <div className="text-muted flex items-center justify-center p-4 text-sm">
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
            if (!d) {
              return null;
            }
            const key = dateKey(d);
            const items = (calendarData[key] ?? []) as PlannedItemDisplay[];
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
                  padding: "4px 2px",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <TimelineDaySection
                  inPanel
                  date={d}
                  dateFormatter={dateFormatter}
                  dateKey={key}
                  isToday={isToday}
                  items={items}
                  onAddItem={handlePlan}
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
  const { afterPlanning, afterPlanningPanel } = useAfterPlanning();

  return (
    <>
      <Panel
        open={open}
        panelClassName="h-[80dvh]"
        title={t("addToCalendar")}
        onOpenChange={onOpenChange}
      >
        <Panel.Body className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {open && (
            <MiniCalendarContent
              recipeId={recipeId}
              onOpenChange={onOpenChange}
              onPlanned={afterPlanning}
            />
          )}
        </Panel.Body>
      </Panel>
      {afterPlanningPanel}
    </>
  );
}
