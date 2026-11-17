import type { DragListHandle } from "@/components/drag-list/drag-list";
import type { FlatListProps } from "react-native";
import React, { useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Animated from "react-native-reanimated";
import { DayCardSkeleton } from "@/components/day-card";
import { DragList } from "@/components/drag-list/drag-list";
import { TabListMarker } from "@/components/tab-list-marker";
import { TabRootHeader } from "@/components/tab-root-header";
import { useFreshRows } from "@/hooks/use-fresh-rows";
import { SPRING_FADE_IN, SPRING_FADE_OUT, SPRING_LAYOUT } from "@/lib/motion/layout";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useTabReselect } from "@/lib/use-tab-reselect";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useCalendarMutations, useCalendarRangeQuery } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";
import { dateKey } from "@norish/shared/lib/helpers";

import type { TimelineRow } from "../utils/timeline-rows";
import { DayHeadingRow, PlannedItemRow, SlotLabelRow } from "../components/timeline-row";
import { TodayControl } from "../components/today-control";
import { useCalendarLinkArrivals } from "../hooks/use-calendar-link-arrivals";
import { useHeldGrowth } from "../hooks/use-held-growth";
import {
  dayRowKey,
  hiddenAbove,
  openingOffset,
  planTimelineDrop,
  rowDay,
  rowLayout,
  timelineRows,
} from "../utils/timeline-rows";
import { todayDirection } from "../utils/today-control";

const SKELETONS = [0, 1, 2, 3];

type ViewableChange = NonNullable<FlatListProps<TimelineRow>["onViewableItemsChanged"]>;

/** How far from an edge, in screens, the timeline grows that edge. */
const GROW_THRESHOLD = 2;

/** A row counts as shown once half of it is on screen; one object, as FlatList asks. */
const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

/** The Calendar tab: web's timeline of day cards, opened on today and growing at either edge as
 * it scrolls. A tap opens a planned item's sheet; a hold lifts it to drag onto another day. */
export function CalendarScreen() {
  const router = useRouter();
  const intl = useIntl();
  // A widget opens the Calendar on a day; without one it opens on today.
  const { day } = useLocalSearchParams<{ day?: string }>();
  const { fontScale } = useWindowDimensions();
  const todayKey = useToday();
  const { days, grow, calendarData, isRead } = useCalendarRangeQuery();
  const { moveItem } = useCalendarMutations();
  const listRef = useRef<DragListHandle>(null);
  // What the list shows, which a held drop keeps apart from `rows`.
  const shownRowsRef = useRef<TimelineRow[]>([]);
  const growth = useHeldGrowth(grow);
  const bar = useTabScroll();
  // A day scrolled to sits just under the bar, not behind it.
  const { barBottom } = bar;
  const listTop = barBottom + 12;
  const scrollToRow = (index: number, animated: boolean) => {
    listRef.current?.scrollToOffset({
      offset: openingOffset(shownRowsRef.current, index, fontScale, 0, listTop),
      animated,
    });
  };
  // The days a row of which is on screen, for the way back to today.
  const [shownDays, setShownDays] = useState<string[]>([]);
  // Stable: FlatList refuses a new viewability callback after its first render.
  const [onViewable] = useState(() => {
    const changed: ViewableChange = ({ viewableItems }) =>
      setShownDays([...new Set(viewableItems.map(({ item }) => rowDay(item)))]);

    return changed;
  });

  const rows = timelineRows(days, calendarData, todayKey);
  // The days the timeline spans and the rows above the shown ones: a change to either adds or
  // removes rows that neither fade in nor slide the rest, so the list keeps its place.
  const span = `${dateKey(days[0]!)}..${dateKey(days.at(-1)!)}`;
  const above = hiddenAbove(rows, shownDays[0] ?? "");
  const { fresh, settled } = useFreshRows(rows, isRead, `${span}|${above}`);
  const todayIndex = rows.findIndex((row) => row.key === dayRowKey(todayKey));
  const direction = todayDirection(shownDays, todayKey, todayIndex >= 0);
  const dayIndex = day ? rows.findIndex((row) => row.key === dayRowKey(day)) : -1;
  const openIndex = dayIndex < 0 ? todayIndex : dayIndex;

  // The offset the list mounts at, fixed on the first render of rows: a day sits just under the
  // bar from the first frame, and rows added above later are kept in place by the list.
  const [openingAt, setOpeningAt] = useState<number | null>(null);

  if (isRead && openingAt === null) {
    setOpeningAt(openIndex < 0 ? 0 : openingOffset(rows, openIndex, fontScale, 0, listTop));
  }

  // An opening `contentOffset` sends no scroll event, which the list's window (under
  // `initialScrollIndex`) and the title wait for: a half-point scroll after the first layout sends it.
  const openedRef = useRef(false);
  const sendOpeningScroll = () => {
    if (openedRef.current || openingAt === null) return;
    openedRef.current = true;
    listRef.current?.scrollToOffset({ offset: openingAt + 0.5, animated: false });
  };

  // A link while the timeline is open scrolls to its day, every time it is tapped.
  useCalendarLinkArrivals((linked) => {
    const index = shownRowsRef.current.findIndex((row) => row.key === dayRowKey(linked));

    if (index >= 0) scrollToRow(index, false);
  });

  const scrollToToday = () => {
    const index = shownRowsRef.current.findIndex((row) => row.key === dayRowKey(todayKey));

    if (index >= 0) scrollToRow(index, true);
  };

  // The tab pressed again while the Calendar shows returns to today.
  useTabReselect(scrollToToday);

  const header = (
    <TabRootHeader offset={bar.offset} title={intl.formatMessage({ id: "calendar.page.title" })} />
  );

  // Until a read holds data an empty day is unknown, not empty: a failed first read stays a skeleton.
  if (!isRead) {
    return (
      <View className="bg-background flex-1" testID="calendar-screen">
        {header}
        <ScrollView
          contentContainerClassName="gap-3.5 px-5"
          // The list's inset, so nothing moves when it replaces the skeleton.
          contentInset={{ top: barBottom }}
          contentInsetAdjustmentBehavior="never"
          scrollEnabled={false}
        >
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
      <TabListMarker>
        <DragList
          ref={listRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: tabListBottomInset(bar.homeIndicator) }}
          // The bar's inset set here, not by UIKit, which shifts an offset given before it applies.
          contentInset={{ top: barBottom }}
          contentInsetAdjustmentBehavior="never"
          contentOffset={{ x: 0, y: openingAt ?? 0 }}
          // A drop lands on its day by the rule, so the day is outlined and no line drawn.
          dropLine={false}
          edgeInsets={{ top: barBottom, bottom: tabListBottomInset(bar.homeIndicator) }}
          // The rows the list shows, which a held row keeps still while `rows` moves on.
          getItemLayout={(shown, index) => ({ ...rowLayout(shown ?? [], index, fontScale), index })}
          initialNumToRender={12}
          initialScrollIndex={openIndex < 0 ? undefined : openIndex}
          itemLayoutAnimation={settled ? SPRING_LAYOUT : undefined}
          // Rows added above keep the ones on screen where they are.
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          renderHeading={(heading) => (
            <Animated.View
              entering={fresh.has(heading) ? SPRING_FADE_IN : undefined}
              exiting={SPRING_FADE_OUT}
            >
              {heading.type === "day" ? (
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
              )}
            </Animated.View>
          )}
          renderItem={(row) => (
            <Animated.View
              entering={fresh.has(row) ? SPRING_FADE_IN : undefined}
              exiting={SPRING_FADE_OUT}
            >
              <PlannedItemRow
                row={row}
                onOpen={() =>
                  router.push({
                    pathname: TAB_ROUTES.calendar.item,
                    params: { id: row.item.id },
                  })
                }
              />
            </Animated.View>
          )}
          rows={rows}
          scrollIndicatorInsets={{ top: barBottom }}
          sectionOf={(heading) => heading.dayKey}
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
          onLayout={sendOpeningScroll}
          onScroll={bar.onScroll}
          onStartReached={() => growth.reached("past")}
          onStartReachedThreshold={GROW_THRESHOLD}
          onViewableItemsChanged={onViewable}
        />
      </TabListMarker>
      <TodayControl
        direction={direction}
        homeIndicator={bar.homeIndicator}
        minimised={bar.minimised}
        onPress={scrollToToday}
      />
    </View>
  );
}
