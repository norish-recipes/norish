import React from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import {
  useMiniCalendar,
  useMovePlannedItem,
  usePlannedItemText,
  usePlanOnDay,
} from "@norish/shared-react/calendar";
import { slotTranslationKeys } from "@norish/shared-react/calendar/todays-meals";
import { useToday } from "@norish/shared-react/reader";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

import { DayCard, DayCardSkeleton } from "../components/day-card";
import { SheetHeader } from "../components/sheet-header";
import { usePlanExit } from "../hooks/use-plan-exit";
import { DAY_CARD, dayCardHeight, dayCardOffsets } from "../utils/day-card-height";

/** The header's own height: 20 pt above, the title and its line, and the 14 pt before the first card; the list's offsets start after it. */
const HEADER = 79;
const SKELETONS = [0, 1, 2, 3];

/**
 * The mini calendar as a sheet: every day from last month to next month, opened on today. With a
 * `recipeId` it plans that recipe; with a `plannedItemId` it moves that item. Either way a day's
 * "+" asks for a slot, and the shared mutation queues in the Outbox offline.
 */
export function PlanScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { recipeId, name, plannedItemId } = useLocalSearchParams<{
    recipeId?: string;
    name?: string;
    plannedItemId?: string;
  }>();
  const plannedItemText = usePlannedItemText();
  const exit = usePlanExit();
  const today = parseDateKey(useToday());
  const { days, todayKey, todayIndex, calendarData, isLoading } = useMiniCalendar(today);
  const allItems = Object.values(calendarData).flat();
  const moved = plannedItemId ? allItems.find((item) => item.id === plannedItemId) : undefined;
  const planOnDay = usePlanOnDay({ recipe: recipeId ? { id: recipeId } : undefined, close: exit });
  const moveTo = useMovePlannedItem({ item: moved, items: allItems, close: () => router.back() });
  const subject = moved ? plannedItemText(moved).title : (name ?? "");
  const isMove = Boolean(plannedItemId);
  const add = isMove ? moveTo : planOnDay;

  const rows: Array<Date | number> = isLoading ? SKELETONS : days;
  const heights = days.map((day) => dayCardHeight(calendarData[dateKey(day)] ?? []));
  const offsets = dayCardOffsets(heights, HEADER);

  const subtitle = moved
    ? intl.formatMessage(
        { id: "calendar.today.moveSubtitle" },
        {
          name: subject,
          slot: intl
            .formatMessage({ id: `common.slots.${slotTranslationKeys[moved.slot]}` })
            .toLocaleLowerCase(intl.locale),
        }
      )
    : subject;

  const header = (
    <View className="h-[79px] pt-5">
      <SheetHeader
        closeTestID="plan-close"
        subtitle={subtitle}
        title={intl.formatMessage({
          id: isMove ? "calendar.today.moveTitle" : "calendar.panel.planThisRecipe",
        })}
        onClose={() => router.back()}
      />
    </View>
  );

  return (
    // react-native-screens sizes only a scroll view that sits directly in the sheet. The list
    // remounts when the plan arrives, so it opens on today instead of jumping there.
    <FlatList
      key={isLoading ? "loading" : "days"}
      ListHeaderComponent={header}
      contentContainerClassName="px-5 pb-8"
      contentInsetAdjustmentBehavior="never"
      // The first frame sits on today, 12 pt under the sheet's top (the card above ends there); the title is above it.
      contentOffset={{ x: 0, y: isLoading || todayIndex < 0 ? 0 : offsets[todayIndex]! - 12 }}
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
        const day = intl.formatDate(item, { weekday: "short", month: "short", day: "numeric" });

        return (
          <View className="pb-3" testID={`plan-day-${index}`}>
            <DayCard
              addLabel={intl.formatMessage(
                { id: isMove ? "calendar.today.moveToDay" : "calendar.panel.planOnDay" },
                { name: subject, day }
              )}
              date={item}
              dateKey={key}
              isToday={key === todayKey}
              items={calendarData[key] ?? []}
              onAdd={(slot: Slot) => add(key, slot)}
            />
          </View>
        );
      }}
      showsVerticalScrollIndicator={false}
      testID="plan-sheet"
    />
  );
}
