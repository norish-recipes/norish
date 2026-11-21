import React from "react";
import { FIT_SHEET_OPTIONS, SEARCH_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { useSheetExit } from "@/lib/after-sheet";
import { Stack } from "expo-router";

import { CalendarRangeProvider, useCalendarSubscription } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";

/** The Calendar tab's stack: the timeline, whose bar-item title hides on scroll, and the sheets over
 * it (planned item, add-to-day, Add to groceries), which read its range too. */
export function CalendarStack() {
  useCalendarSubscription();
  const sheetExit = useSheetExit();

  return (
    <CalendarRangeProvider today={useToday()}>
      <Stack
        screenOptions={{ headerShown: false }}
        unstable_nativeProps={{ onFinishTransitioning: sheetExit }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="item" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="plan-recipe" options={SEARCH_SHEET_OPTIONS} />
        <Stack.Screen name="add-to-groceries" options={SHEET_OPTIONS} />
      </Stack>
    </CalendarRangeProvider>
  );
}
