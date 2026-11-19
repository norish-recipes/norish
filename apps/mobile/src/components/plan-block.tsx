import type { FlatList } from "react-native";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { DayCard, DayCardSkeleton, formatDay } from "@/components/day-card";
import { DayStrip } from "@/components/day-strip";
import { Segmented } from "@/components/segmented";
import { SheetList } from "@/components/sheet";
import { DAY_CARD, DAY_LIST_TOP, dayCardHeight, dayCardOffsets } from "@/lib/day-card-height";
import { useSlotSegments } from "@/lib/slot-segments";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { useMiniCalendar } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

const SKELETONS = [0, 1, 2, 3];

type PickerProps = {
  /** The picked day's date key. */
  date: string;
  slot: Slot;
  /** The prefix of every control's testID. */
  testID: string;
  onDateChange: (day: string, fromChip: boolean) => void;
  onSlotChange: (slot: Slot) => void;
};

/** The plan block's head: the day strip with its date picker, then the slot tabs. `days` false
 * leaves the strip out, for a sheet opened on one day. */
export function PlanPicker({
  date,
  slot,
  testID,
  days = true,
  onDateChange,
  onSlotChange,
}: PickerProps & { days?: boolean }) {
  const segments = useSlotSegments(`${testID}-slot`);

  return (
    <View className="gap-3">
      {days ? <DayStrip date={date} testID={testID} onChange={onDateChange} /> : null}
      <Segmented
        segments={segments}
        testID={`${testID}-slot`}
        value={slot}
        onChange={onSlotChange}
      />
    </View>
  );
}

/**
 * The whole plan block: the picker, fixed above a list of day cards from last month to next month,
 * opened on today. A day's "+" calls `onAdd`; a strip pick scrolls the list to its day.
 */
export function PlanDayList({
  testID,
  name,
  onAdd,
  ...picker
}: PickerProps & {
  /** What a day's "+" plans or moves, for its VoiceOver label. */
  name: string;
  onAdd: (dayKey: string) => void;
}) {
  const intl = useIntl();
  const today = parseDateKey(useToday());
  const { days, todayKey, todayIndex, calendarData, isLoading } = useMiniCalendar(today);
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

  const scrollTo = (key: string) => {
    const index = days.findIndex((day) => dateKey(day) === key);

    if (isLoading || index < 0) return;
    touchedRef.current = true;
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  return (
    <View className="flex-1" collapsable={false}>
      <View className="px-4 pt-1 pb-3">
        <PlanPicker
          {...picker}
          testID={testID}
          onDateChange={(day, fromChip) => {
            picker.onDateChange(day, fromChip);
            scrollTo(day);
          }}
        />
      </View>
      <SheetList
        nested
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
        renderItem={({ item }) => {
          if (typeof item === "number") {
            return (
              <View className="pb-3">
                <DayCardSkeleton />
              </View>
            );
          }
          const key = dateKey(item);

          return (
            <View className="pb-3">
              <DayCard
                addLabel={intl.formatMessage(
                  { id: "calendar.panel.planOnDay" },
                  { name, day: formatDay(intl, item) }
                )}
                date={item}
                dateKey={key}
                isToday={key === todayKey}
                items={calendarData[key] ?? []}
                testID={testID}
                onAdd={() => onAdd(key)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}
