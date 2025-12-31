import type { RecurrencePattern } from "@/types/recurrence";

import { format, parseISO, differenceInDays } from "date-fns";

/**
 * Translation function type for recurrence formatting.
 * Matches the signature of next-intl's useTranslations return type.
 */
export type RecurrenceTranslations = {
  every: string;
  everyOther: string;
  on: string;
  day: string;
  days: string;
  week: string;
  weeks: string;
  month: string;
  months: string;
  today: string;
  tomorrow: string;
  weekdaysFull: Record<string, string>;
};

/**
 * Default English translations for recurrence formatting.
 * Used when no translations are provided (e.g., server-side rendering).
 */
const DEFAULT_TRANSLATIONS: RecurrenceTranslations = {
  every: "Every",
  everyOther: "Every other",
  on: "on",
  day: "day",
  days: "days",
  week: "week",
  weeks: "weeks",
  month: "month",
  months: "months",
  today: "today",
  tomorrow: "tomorrow",
  weekdaysFull: {
    "0": "Sunday",
    "1": "Monday",
    "2": "Tuesday",
    "3": "Wednesday",
    "4": "Thursday",
    "5": "Friday",
    "6": "Saturday",
  },
};

/**
 * Format a recurrence pattern into a human-readable summary.
 * Examples: "Every day", "Every 2 weeks on Monday", "Every month on Thursday"
 *
 * @param pattern - The recurrence pattern to format
 * @param translations - Optional translations object for localization
 */
export function formatRecurrenceSummary(
  pattern: RecurrencePattern,
  translations: RecurrenceTranslations = DEFAULT_TRANSLATIONS
): string {
  const { rule, interval, weekday } = pattern;
  const t = translations;

  // Build interval text
  let intervalText = "";

  if (interval === 1) {
    intervalText = t.every;
  } else if (interval === 2) {
    intervalText = t.everyOther;
  } else {
    intervalText = `${t.every} ${interval}`;
  }

  // Build unit text
  let unitText = "";

  switch (rule) {
    case "day":
      unitText = interval === 1 ? t.day : t.days;
      break;
    case "week":
      unitText = interval === 1 ? t.week : t.weeks;
      break;
    case "month":
      unitText = interval === 1 ? t.month : t.months;
      break;
  }

  // Build weekday text if applicable
  let weekdayText = "";

  if (weekday !== undefined) {
    const weekdayName = t.weekdaysFull[weekday.toString()] ?? "";

    weekdayText = ` ${t.on} ${weekdayName}`;
  }

  return `${intervalText} ${unitText}${weekdayText}`;
}

/**
 * Format the next occurrence date into a readable text.
 * Examples: "today", "tomorrow", "Monday", "Nov 25"
 *
 * @param nextDate - ISO date string of the next occurrence
 * @param translations - Optional translations object for localization
 * @param locale - Optional date-fns locale for date formatting
 */
export function formatNextOccurrence(
  nextDate: string,
  translations: Pick<
    RecurrenceTranslations,
    "today" | "tomorrow" | "weekdaysFull"
  > = DEFAULT_TRANSLATIONS
): string {
  const next = parseISO(nextDate);
  const today = new Date();
  const t = translations;

  // Use startOfDay to ensure accurate day calculations
  const nextDay = new Date(next);

  nextDay.setHours(0, 0, 0, 0);
  const todayDay = new Date(today);

  todayDay.setHours(0, 0, 0, 0);

  const daysDiff = differenceInDays(nextDay, todayDay);

  if (daysDiff === 0) {
    return t.today;
  } else if (daysDiff === 1) {
    return t.tomorrow;
  } else if (daysDiff > 0 && daysDiff <= 6) {
    // Use translated weekday name
    const weekdayIndex = next.getDay();

    return t.weekdaysFull[weekdayIndex.toString()] ?? format(next, "EEEE");
  } else if (daysDiff < 365) {
    return format(next, "MMM d"); // e.g., "Nov 25"
  } else {
    return format(next, "MMM d, yyyy"); // e.g., "Nov 25, 2026"
  }
}

/**
 * Format a full recurrence description with next occurrence.
 * Example: "Every week on Monday • Next: Nov 25"
 *
 * @param pattern - The recurrence pattern to format
 * @param nextDate - ISO date string of the next occurrence
 * @param translations - Optional translations object for localization
 * @param nextLabel - Label for "Next:" (e.g., "Volgende:")
 */
export function formatRecurrenceWithNext(
  pattern: RecurrencePattern,
  nextDate: string,
  translations: RecurrenceTranslations = DEFAULT_TRANSLATIONS,
  nextLabel: string = "Next:"
): string {
  const summary = formatRecurrenceSummary(pattern, translations);
  const nextText = formatNextOccurrence(nextDate, translations);

  return `${summary} • ${nextLabel} ${nextText}`;
}

/**
 * Format a recurrence pattern as input text (e.g., for edit mode).
 * Examples: "every day", "every 2 weeks", "every week on monday"
 *
 * Note: This returns lowercase English text suitable for parsing.
 * For display purposes, use formatRecurrenceSummary instead.
 */
export function formatRecurrenceAsText(pattern: RecurrencePattern): string {
  const { rule, interval, weekday } = pattern;

  let text = "every";

  // Add interval
  if (interval === 2) {
    text += " other";
  } else if (interval > 2) {
    text += ` ${interval}`;
  }

  // Add unit
  switch (rule) {
    case "day":
      text += interval === 1 ? " day" : " days";
      break;
    case "week":
      text += interval === 1 ? " week" : " weeks";
      break;
    case "month":
      text += interval === 1 ? " month" : " months";
      break;
  }

  // Add weekday if specified
  if (weekday !== undefined) {
    const weekdayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    text += ` on ${weekdayNames[weekday]}`;
  }

  return text;
}
