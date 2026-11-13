"use client";

import { useMemo, useRef } from "react";
import { settleLanding, useLandOnDay } from "@/components/calendar/land-on-day";
import { TimelineDaySection } from "@/components/calendar/timeline-day-section";
import Panel from "@/components/Panel/Panel";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";

import { useMiniCalendar, usePlanOnDay } from "@norish/shared-react/calendar";
import { useRecipeQuery } from "@norish/shared-react/recipes";
import { dateKey } from "@norish/shared/lib/helpers";

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
  // TanStack Virtual hands back one mutable instance, so compiled memoisation
  // would keep its first rows.
  "use no memo";

  const t = useTranslations("calendar.panel");
  const locale = useLocale();
  const today = useMemo(() => new Date(), []);
  const { recipe } = useRecipeQuery(recipeId);
  const { days: allDays, todayKey, todayIndex, calendarData, isLoading } = useMiniCalendar(today);
  const close = () => onOpenChange(false);
  const handlePlan = usePlanOnDay({ recipe, close, onPlanned });
  // A day's date on one line, as the calendar itself writes it: "Wed, Oct 7"
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }),
    [locale]
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
  const landingAskedRef = useRef(false);

  useLandOnDay(virtualizer, todayIndex, isLoading, landingAskedRef);
  const virtualItems = virtualizer.getVirtualItems();
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
            const items = calendarData[key] ?? [];
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
          <MiniCalendarContent
            recipeId={recipeId}
            onOpenChange={onOpenChange}
            onPlanned={afterPlanning}
          />
        </Panel.Body>
      </Panel>
      {afterPlanningPanel}
    </>
  );
}
