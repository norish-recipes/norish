import type { FlatList } from "react-native";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { DayCard, DayCardSkeleton, formatDay } from "@/components/day-card";
import { Sheet, SheetList } from "@/components/sheet";
import { DAY_CARD, DAY_LIST_TOP, dayCardHeight, dayCardOffsets } from "@/lib/day-card-height";
import { useLocalSearchParams } from "expo-router";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { useMiniCalendar, usePlanOnDay } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

import { usePlanExit } from "../hooks/use-plan-exit";

const SKELETONS = [0, 1, 2, 3];

/**
 * Plan a recipe from the recipe: the mini calendar as a sheet, every day from last month to next
 * month, opened on today. The shared mutations queue in the Outbox offline.
 */
export function PlanCalendarScreen() {
  const intl = useIntl();
  const today = parseDateKey(useToday());
  const { days, todayKey, todayIndex, calendarData, isLoading } = useMiniCalendar(today);
  const { recipeId, name } = useLocalSearchParams<{ recipeId: string; name?: string }>();
  const exit = usePlanExit();
  const planOnDay = usePlanOnDay({ recipe: { id: recipeId }, close: exit });

  const rows: Array<Date | number> = isLoading ? SKELETONS : days;
  const heights = days.map((day) => dayCardHeight(calendarData[dateKey(day)] ?? []));
  const offsets = dayCardOffsets(heights, DAY_LIST_TOP);
  const todayTop = offsets[todayIndex];
  const listRef = useRef<FlatList<Date | number>>(null);
  const touchedRef = useRef(false);

  // A refetch can grow the cards above today after the list mounted; until a drag, keep today in view.
  useEffect(() => {
    if (touchedRef.current || isLoading || todayIndex < 0) return;
    listRef.current?.scrollToIndex({ index: todayIndex, animated: false });
  }, [todayTop, isLoading, todayIndex]);

  return (
    <Sheet
      name="plan"
      subtitle={name ?? ""}
      title={intl.formatMessage({ id: "calendar.panel.planThisRecipe" })}
    >
      <SheetList
        // The list remounts when the plan arrives, so it opens on today instead of jumping there.
        key={isLoading ? "loading" : "days"}
        ref={listRef}
        data={rows}
        getItemLayout={
          isLoading
            ? undefined
            : (_, index) => ({
                length: heights[index]! + DAY_CARD.gap,
                offset: offsets[index]!,
                index,
              })
        }
        initialNumToRender={8}
        initialScrollIndex={isLoading || todayIndex < 0 ? undefined : todayIndex}
        keyExtractor={(item) => (typeof item === "number" ? `skeleton-${item}` : dateKey(item))}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScrollBeginDrag={() => {
          touchedRef.current = true;
        }}
        renderItem={({ item, index }) => {
          if (typeof item === "number") {
            return (
              <View className="pb-3">
                <DayCardSkeleton />
              </View>
            );
          }
          const key = dateKey(item);

          return (
            <View className="pb-3" testID={`plan-day-${index}`}>
              <DayCard
                addLabel={intl.formatMessage(
                  { id: "calendar.panel.planOnDay" },
                  { name: name ?? "", day: formatDay(intl, item) }
                )}
                date={item}
                dateKey={key}
                isToday={key === todayKey}
                items={calendarData[key] ?? []}
                onAdd={(slot: Slot) => planOnDay(key, slot)}
              />
            </View>
          );
        }}
      />
    </Sheet>
  );
}
