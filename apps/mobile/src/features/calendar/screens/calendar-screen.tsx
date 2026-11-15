import type { FlatList, FlatListProps } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DayCardSkeleton } from "@/components/day-card";
import { DragList } from "@/components/drag-list/drag-list";
import { tabListBottomInset } from "@/components/tab-list-inset";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useCalendarMutations, useCalendarRangeQuery } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";

import type { TimelineRow } from "../utils/timeline-rows";
import { CalendarHeader } from "../components/calendar-header";
import { DayHeadingRow, PlannedItemRow, SlotLabelRow } from "../components/timeline-row";
import { useHeldGrowth } from "../hooks/use-held-growth";
import {
  dayRowKey,
  planTimelineDrop,
  rowDay,
  rowLayout,
  timelineRows,
} from "../utils/timeline-rows";

const SKELETONS = [0, 1, 2, 3];

type ViewableChange = NonNullable<FlatListProps<TimelineRow>["onViewableItemsChanged"]>;

/** How far from an edge, in screens, the timeline grows that edge. */
const GROW_THRESHOLD = 2;

/** A row counts as shown once half of it is on screen; one object, as FlatList asks. */
const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

/**
 * The Calendar tab: web's timeline of day cards, opened on today and growing at either edge as it
 * scrolls. A tap opens a planned item's sheet; a hold lifts it to drag onto another day.
 */
export function CalendarScreen() {
  const router = useRouter();
  // A widget opens the Calendar on a day; without one it opens on today.
  const { day } = useLocalSearchParams<{ day?: string }>();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const todayKey = useToday();
  const { days, grow, calendarData, isRead } = useCalendarRangeQuery();
  const { moveItem } = useCalendarMutations();
  const listRef = useRef<FlatList<TimelineRow>>(null);
  // What the list shows, which a held drop keeps apart from `rows`.
  const shownRowsRef = useRef<TimelineRow[]>([]);
  const growth = useHeldGrowth(grow);
  // The days a row of which is on screen, for the way back to today.
  const [shownDays, setShownDays] = useState<string[]>([]);
  // Stable: FlatList refuses a new viewability callback after its first render.
  const [onViewable] = useState(() => {
    const changed: ViewableChange = ({ viewableItems }) =>
      setShownDays([...new Set(viewableItems.map(({ item }) => rowDay(item)))]);

    return changed;
  });

  const rows = timelineRows(days, calendarData, todayKey);
  const todayIndex = rows.findIndex((row) => row.key === dayRowKey(todayKey));
  const todayShown = todayIndex < 0 || shownDays.length === 0 || shownDays.includes(todayKey);
  const dayIndex = day ? rows.findIndex((row) => row.key === dayRowKey(day)) : -1;
  const openIndex = dayIndex < 0 ? todayIndex : dayIndex;

  // A link to another day while the timeline is open scrolls to it.
  useEffect(() => {
    if (!day) return;
    const index = shownRowsRef.current.findIndex((row) => row.key === dayRowKey(day));

    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: false });
  }, [day]);

  const header = (
    <CalendarHeader
      todayDirection={todayShown ? null : (shownDays[0] ?? "") > todayKey ? "up" : "down"}
      onToday={() => {
        const index = shownRowsRef.current.findIndex((row) => row.key === dayRowKey(todayKey));

        if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true });
      }}
    />
  );

  // Until a read holds data an empty day is unknown, not empty: a failed first read stays a skeleton.
  if (!isRead) {
    return (
      <View className="bg-background flex-1" testID="calendar-screen">
        {header}
        <ScrollView contentContainerClassName="gap-3.5 px-5" scrollEnabled={false}>
          {SKELETONS.map((key) => (
            <DayCardSkeleton key={key} className="bg-surface" />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1" testID="calendar-screen">
      {header}
      <DragList
        ref={listRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: tabListBottomInset(insets.bottom) }}
        contentInsetAdjustmentBehavior="never"
        // The rows the list shows, which a held row keeps still while `rows` moves on.
        getItemLayout={(shown, index) => ({ ...rowLayout(shown ?? [], index, fontScale), index })}
        initialNumToRender={12}
        initialScrollIndex={openIndex < 0 ? undefined : openIndex}
        // Rows added above keep the ones on screen where they are.
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        renderHeading={(heading) =>
          heading.type === "day" ? (
            <DayHeadingRow
              heading={heading}
              onAdd={() =>
                router.push({
                  pathname: TAB_ROUTES.calendar.planRecipe,
                  params: { date: heading.dayKey },
                })
              }
            />
          ) : (
            <SlotLabelRow heading={heading} />
          )
        }
        renderItem={(row, drag) => (
          <PlannedItemRow
            row={row}
            onDrag={drag}
            onOpen={() =>
              router.push({ pathname: TAB_ROUTES.calendar.item, params: { id: row.item.id } })
            }
          />
        )}
        rows={rows}
        shownRef={shownRowsRef}
        testID="calendar-list"
        viewabilityConfig={VIEWABILITY}
        onDrop={(drop) => {
          const plan = planTimelineDrop(drop, calendarData);

          if (!plan) return false;
          moveItem(plan.itemId, plan.date, plan.slot, plan.index);

          return true;
        }}
        onEndReached={() => growth.reached("future")}
        onEndReachedThreshold={GROW_THRESHOLD}
        onHeldChange={growth.heldChange}
        onStartReached={() => growth.reached("past")}
        onStartReachedThreshold={GROW_THRESHOLD}
        onViewableItemsChanged={onViewable}
      />
    </View>
  );
}
