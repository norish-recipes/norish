import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import {
  clearCalendarWidgets,
  startCalendarWidgets,
  syncCalendarWidgets,
} from "@/lib/calendar-widgets";
import { WIDGET_DATA_DAYS } from "@/lib/calendar-widgets-state";
import { useIntl } from "react-intl";

import { useCalendarQuery } from "@norish/shared-react/calendar";
import { useToday } from "@norish/shared-react/reader";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

/**
 * Hands the Home Screen widgets the plan whenever it changes here, realtime and this device's
 * writes included, and on every return to the foreground. Pushing never blocks the caller.
 */
export function useCalendarWidgets() {
  const intl = useIntl();
  const todayKey = useToday();
  const today = parseDateKey(todayKey);
  const endISO = dateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + WIDGET_DATA_DAYS - 1)
  );
  const { calendarData, isRead } = useCalendarQuery({ startISO: todayKey, endISO });
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
  // An unread range is unknown, not empty: nothing is pushed until a read holds data.
  const sync = useEffectEvent(() => {
    if (isRead) void syncCalendarWidgets(calendarData, strings);
  });

  useEffect(() => startCalendarWidgets(), []);

  useEffect(() => sync(), [shape, isRead, todayKey, intl.locale]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => subscription.remove();
  }, []);
}

/** Signed out, both widgets say "Open Norish to sign in" in the app's language and hold no photos. */
export function useSignedOutWidgets() {
  const signIn = useIntl().formatMessage({ id: "calendar.widgets.signIn" });

  useEffect(() => void clearCalendarWidgets(signIn), [signIn]);
}
