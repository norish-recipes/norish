export const RECURRENCE_RULES = ["day", "week", "month", "year"] as const;

export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  return (RECURRENCE_RULES as readonly unknown[]).includes(value);
}

export type RecurrenceLocaleConfig = {
  everyWords: string[];
  otherWords: string[];
  onWords: string[];
  numberWords: Record<string, number>;
  unitWords: {
    day: string[];
    week: string[];
    month: string[];
    year: string[];
  };
  weekdayWords: Record<string, number>;
  intervalHints: Array<{
    phrases: string[];
    interval: number;
    rule: RecurrenceRule;
  }>;
};

export type RecurrenceConfig = {
  locales: Record<string, RecurrenceLocaleConfig>;
};

export type RecurrencePattern = {
  rule: RecurrenceRule;
  interval: number;
  weekday?: number; // 0-6 (Sunday-Saturday)
};

/** A recurring grocery's stored rule, interval and weekday, as the pattern the calculator reads. */
export function recurrencePatternOf(row: {
  recurrenceRule: RecurrenceRule;
  recurrenceInterval: number;
  recurrenceWeekday?: number | null;
}): RecurrencePattern {
  return {
    rule: row.recurrenceRule,
    interval: row.recurrenceInterval,
    weekday: row.recurrenceWeekday ?? undefined,
  };
}
