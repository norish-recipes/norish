import { describe, expect, it } from "vitest";

import { recurrenceTranslationsFrom } from "@norish/shared/lib/recurrence/formatter";
import {
  recurrenceHasWeekday,
  stepRecurrenceInterval,
  withRecurrenceRule,
} from "@norish/shared/lib/recurrence/pattern";

describe("withRecurrenceRule", () => {
  it("starts a pattern at every one, and a week on Monday", () => {
    expect(withRecurrenceRule(null, "week")).toEqual({ rule: "week", interval: 1, weekday: 1 });
    expect(withRecurrenceRule(null, "day")).toEqual({
      rule: "day",
      interval: 1,
      weekday: undefined,
    });
  });

  it("keeps the interval and the weekday across a week or month, and drops it for the rest", () => {
    const friday = { rule: "week", interval: 2, weekday: 5 } as const;

    expect(withRecurrenceRule(friday, "month")).toEqual({ rule: "month", interval: 2, weekday: 5 });
    expect(withRecurrenceRule(friday, "year")).toEqual({
      rule: "year",
      interval: 2,
      weekday: undefined,
    });
  });
});

describe("stepRecurrenceInterval", () => {
  it("never goes below one", () => {
    const daily = { rule: "day", interval: 1 } as const;

    expect(stepRecurrenceInterval(daily, -1).interval).toBe(1);
    expect(stepRecurrenceInterval(daily, 1).interval).toBe(2);
  });
});

describe("recurrenceHasWeekday", () => {
  it("is true for a weekly or monthly pattern only", () => {
    expect(recurrenceHasWeekday({ rule: "week", interval: 1 })).toBe(true);
    expect(recurrenceHasWeekday({ rule: "month", interval: 1 })).toBe(true);
    expect(recurrenceHasWeekday({ rule: "day", interval: 1 })).toBe(false);
    expect(recurrenceHasWeekday(null)).toBe(false);
  });
});

describe("recurrenceTranslationsFrom", () => {
  it("reads each rule's summary with its interval, and the seven weekdays, through the lookup", () => {
    const words = recurrenceTranslationsFrom(
      (key, values) => `<${key}${values ? JSON.stringify(values) : ""}>`
    );

    expect(words.summary("week", 2)).toBe('<everyWeek{"interval":2}>');
    expect(words.onWeekday("x", "Fri")).toBe('<onWeekday{"repeat":"x","weekday":"Fri"}>');
    expect(words.weekdaysFull["3"]).toBe("<weekdaysFull.3>");
    expect(Object.keys(words.weekdaysFull)).toHaveLength(7);
  });
});
