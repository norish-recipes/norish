import type { FlatList } from "react-native";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { DayCard, DayCardSkeleton } from "@/components/day-card";
import { DayStrip } from "@/components/day-strip";
import { Segmented } from "@/components/segmented";
import { SheetList } from "@/components/sheet";
import {
  DAY_CARD,
  DAY_LIST_TOP,
  dayCardHeight,
  dayCardOffsets,
  PLAN_PICKER_HEIGHT,
} from "@/lib/day-card-height";
import { useSlotSegments } from "@/lib/slot-segments";

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
 * The whole plan block: the picker, then a day card for every day from last month to next month,
 * opened on today. A day's "+" calls `onAdd`; the strip and "+" scroll the list to their day.
 */
export function PlanDayList({
  testID,
  addLabel,
  onAdd,
  ...picker
}: PickerProps & {
  /** What VoiceOver calls a day's "+". */
  addLabel: (day: Date) => string;
  onAdd: (dayKey: string) => void;
}) {
  const today = parseDateKey(useToday());
  const { days, todayKey, todayIndex, calendarData, isLoading } = useMiniCalendar(today);
  const rows: Array<Date | number> = isLoading ? SKELETONS : days;
  const heights = days.map((day) => dayCardHeight(calendarData[dateKey(day)] ?? []));
  const offsets = dayCardOffsets(heights, DAY_LIST_TOP + PLAN_PICKER_HEIGHT);
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
    <SheetList
      // The list remounts when the plan arrives, so it opens on today instead of jumping there.
      key={isLoading ? "loading" : "days"}
      ref={listRef}
      ListHeaderComponent={
        <View className="pb-3">
          <PlanPicker
            {...picker}
            testID={testID}
            onDateChange={(day, fromChip) => {
              picker.onDateChange(day, fromChip);
              scrollTo(day);
            }}
          />
        </View>
      }
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
          <View className="pb-3" testID={`${testID}-day-card-${index}`}>
            <DayCard
              addLabel={addLabel(item)}
              date={item}
              dateKey={key}
              isToday={key === todayKey}
              items={calendarData[key] ?? []}
              onAdd={() => onAdd(key)}
            />
          </View>
        );
      }}
    />
  );
}
