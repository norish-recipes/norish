import React from "react";
import { FlatList, View } from "react-native";
import { DayCard, DayCardSkeleton, formatDay } from "@/components/day-card";
import { DAY_CARD, dayCardHeight, dayCardOffsets } from "@/components/day-card-height";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import {
  useMiniCalendar,
  useMovePlannedItem,
  usePlannedItemText,
  usePlanOnDay,
} from "@norish/shared-react/calendar";
import { slotTranslationKeys } from "@norish/shared-react/calendar/todays-meals";
import { useToday } from "@norish/shared-react/reader";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

import { SheetHeader } from "../components/sheet-header";
import { usePlanExit } from "../hooks/use-plan-exit";

const SKELETONS = [0, 1, 2, 3];

type Mode = {
  title: string;
  subtitle: string;
  /** What VoiceOver calls a day's "+", with the day to fill in. */
  addLabel: (day: string) => string;
  add: (dayKey: string, slot: Slot) => void;
};

/** The route's params as one mode: plan `recipeId` (named `name`), or move the item `plannedItemId`. */
function usePlanMode(items: PlannedItemFromQuery[]): Mode {
  const intl = useIntl();
  const router = useRouter();
  const exit = usePlanExit();
  const plannedItemText = usePlannedItemText();
  const { recipeId, name, plannedItemId } = useLocalSearchParams<{
    recipeId?: string;
    name?: string;
    plannedItemId?: string;
  }>();
  const planOnDay = usePlanOnDay({ recipe: recipeId ? { id: recipeId } : undefined, close: exit });
  const moveTo = useMovePlannedItem({
    itemId: plannedItemId ?? "",
    items,
    close: () => router.back(),
  });

  if (plannedItemId) {
    const moved = items.find((item) => item.id === plannedItemId);
    const subject = moved ? plannedItemText(moved).title : "";

    return {
      title: intl.formatMessage({ id: "calendar.today.moveTitle" }),
      subtitle: moved
        ? intl.formatMessage(
            { id: "calendar.today.moveSubtitle" },
            {
              name: subject,
              slot: intl
                .formatMessage({ id: `common.slots.${slotTranslationKeys[moved.slot]}` })
                .toLocaleLowerCase(intl.locale),
            }
          )
        : "",
      addLabel: (day) =>
        intl.formatMessage({ id: "calendar.today.moveToDay" }, { name: subject, day }),
      add: moveTo,
    };
  }

  return {
    title: intl.formatMessage({ id: "calendar.panel.planThisRecipe" }),
    subtitle: name ?? "",
    addLabel: (day) =>
      intl.formatMessage({ id: "calendar.panel.planOnDay" }, { name: name ?? "", day }),
    add: planOnDay,
  };
}

/**
 * The mini calendar as a sheet: every day from last month to next month, opened on today. Its
 * header is pinned above the list, and the shared mutations queue in the Outbox offline.
 */
export function PlanCalendarScreen() {
  const intl = useIntl();
  const router = useRouter();
  const today = parseDateKey(useToday());
  const { days, todayKey, todayIndex, calendarData, isLoading } = useMiniCalendar(today);
  const mode = usePlanMode(Object.values(calendarData).flat());

  const rows: Array<Date | number> = isLoading ? SKELETONS : days;
  const heights = days.map((day) => dayCardHeight(calendarData[dateKey(day)] ?? []));
  const offsets = dayCardOffsets(heights, 0);

  return (
    <>
      {/* react-native-screens takes a sheet's first child as a header and sizes the list below it. */}
      <View className="px-4 pt-[27px] pb-3.5" collapsable={false}>
        <SheetHeader
          closeTestID="plan-close"
          subtitle={mode.subtitle}
          title={mode.title}
          onClose={() => router.back()}
        />
      </View>
      <FlatList
        // The list remounts when the plan arrives, so it opens on today instead of jumping there.
        key={isLoading ? "loading" : "days"}
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        contentInsetAdjustmentBehavior="never"
        contentOffset={{ x: 0, y: isLoading || todayIndex < 0 ? 0 : offsets[todayIndex]! }}
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
        keyExtractor={(item) => (typeof item === "number" ? `skeleton-${item}` : dateKey(item))}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
                addLabel={mode.addLabel(formatDay(intl, item))}
                date={item}
                dateKey={key}
                isToday={key === todayKey}
                items={calendarData[key] ?? []}
                onAdd={(slot: Slot) => mode.add(key, slot)}
              />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        testID="plan-sheet"
      />
    </>
  );
}
