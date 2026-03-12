export type RecurrenceLocaleConfig = {
  everyWords: string[];
  otherWords: string[];
  onWords: string[];
  numberWords: Record<string, number>;
  unitWords: {
    day: string[];
    week: string[];
    month: string[];
  };
  weekdayWords: Record<string, number>;
  intervalHints: Array<{
    phrases: string[];
    interval: number;
    rule: "day" | "week" | "month";
  }>;
};

export type RecurrenceConfig = {
  locales: Record<string, RecurrenceLocaleConfig>;
};

export type RecurrenceRule = "day" | "week" | "month";

export type RecurrencePattern = {
  rule: RecurrenceRule;
  interval: number;
  weekday?: number; // 0-6 (Sunday-Saturday)
};
