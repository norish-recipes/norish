import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import { startCalendarWidgets, syncCalendarWidgets } from "@/lib/calendar-widgets";
import { WIDGET_DATA_DAYS } from "@/lib/calendar-widgets-state";
import { useIntl } from "react-intl";

import { useCalendarQuery, useCalendarRangeRead } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";
import { addDays, dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/**
 * Hands the Home Screen widgets the plan whenever it changes here, realtime and this device's
 * writes included, and on every return to the foreground. Pushing never blocks the caller.
 */
export function useCalendarWidgets() {
  const intl = useIntl();
  const todayKey = useToday();
  const range = {
    startISO: todayKey,
    endISO: dateKey(addDays(parseDateKey(todayKey), WIDGET_DATA_DAYS - 1)),
  };
  const { calendarData } = useCalendarQuery(range);
  // Not the query's `isRead`: seeded from other ranges, that holds days no read of this one confirmed.
  const read = useCalendarRangeRead(range);
  const message = (id: string) => intl.formatMessage({ id });
  const strings = {
    nothingPlanned: message("calendar.widgets.nothingPlanned"),
    signIn: message("calendar.widgets.signIn"),
    open: message("calendar.widgets.open"),
    calendar: message("calendar.page.title"),
    today: message("calendar.mobile.today"),
    untitled: message("calendar.timeline.untitled"),
    slots: {
      Breakfast: message("common.slots.breakfast"),
      Lunch: message("common.slots.lunch"),
      Dinner: message("common.slots.dinner"),
      Snack: message("common.slots.snack"),
    },
    more: (count: number) => intl.formatMessage({ id: "calendar.widgets.more" }, { count }),
    weekday: (date: Date) => intl.formatDate(date, { weekday: "long" }),
    weekdayShort: (date: Date) => intl.formatDate(date, { weekday: "short" }),
  };
  const shape = JSON.stringify(calendarData);
  // An unread range is unknown, not empty: nothing is pushed, so the widgets keep what they were handed.
  const sync = useEffectEvent(() => {
    if (read) void syncCalendarWidgets(calendarData, strings);
  });

  useEffect(() => startCalendarWidgets(), []);

  useEffect(() => sync(), [shape, read, todayKey, intl.locale]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => subscription.remove();
  }, []);
}
