import { differenceInDays } from "date-fns/differenceInDays";
import { format } from "date-fns/format";
import { parseISO } from "date-fns/parseISO";

import type { RecurrencePattern, RecurrenceRule } from "@norish/shared/contracts/recurrence";

/** The words a recurrence reads in: a pattern's summary and weekday from the reader's messages. */
export type RecurrenceTranslations = {
  /** "Every other week": the rule at its interval, as the language counts it. */
  summary: (rule: RecurrenceRule, interval: number) => string;
  /** "Every week on Friday". */
  onWeekday: (repeat: string, weekday: string) => string;
  today: string;
  tomorrow: string;
  weekdaysFull: Record<string, string>;
};

const SUMMARY_KEYS = {
  day: "everyDay",
  week: "everyWeek",
  month: "everyMonth",
  year: "everyYear",
} as const;

/** The words a formatter reads, from a `common.recurrence` message lookup that takes ICU values. */
export function recurrenceTranslationsFrom(
  t: (key: string, values?: Record<string, string | number>) => string
): RecurrenceTranslations {
  return {
    summary: (rule, interval) => t(SUMMARY_KEYS[rule], { interval }),
    onWeekday: (repeat, weekday) => t("onWeekday", { repeat, weekday }),
    today: t("today"),
    tomorrow: t("tomorrow"),
    weekdaysFull: Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((day) => [String(day), t(`weekdaysFull.${day}`)])
    ),
  };
}

const UNIT_PLURALS = { day: "days", week: "weeks", month: "months", year: "years" } as const;

/** English, for a caller with no messages (the server, and text the parser reads back). */
const DEFAULT_TRANSLATIONS: RecurrenceTranslations = {
  summary: (rule, interval) =>
    interval === 1
      ? `Every ${rule}`
      : interval === 2
        ? `Every other ${rule}`
        : `Every ${interval} ${UNIT_PLURALS[rule]}`,
  onWeekday: (repeat, weekday) => `${repeat} on ${weekday}`,
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

/** The translation key of the unit word a pattern reads in, singular or plural. */
export function recurrenceUnitKey({
  rule,
  interval,
}: RecurrencePattern): RecurrenceRule | (typeof UNIT_PLURALS)[RecurrenceRule] {
  return interval === 1 ? rule : UNIT_PLURALS[rule];
}

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
  const summary = translations.summary(rule, interval);

  if (weekday === undefined) return summary;

  return translations.onWeekday(summary, translations.weekdaysFull[weekday.toString()] ?? "");
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
  const { interval, weekday } = pattern;

  let text = "every";

  // Add interval
  if (interval === 2) {
    text += " other";
  } else if (interval > 2) {
    text += ` ${interval}`;
  }

  // Add unit
  text += ` ${recurrenceUnitKey(pattern)}`;

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
