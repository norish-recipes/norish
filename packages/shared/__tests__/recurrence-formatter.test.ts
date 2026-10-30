import { describe, expect, it } from "vitest";

import type { RecurrenceConfig, RecurrencePattern } from "@norish/shared/contracts/recurrence";
import defaultRecurrenceConfig from "@norish/config/recurrence-config.default.json";
import {
  formatRecurrenceAsText,
  formatRecurrenceSummary,
} from "@norish/shared/lib/recurrence/formatter";
import { parseRecurrence } from "@norish/shared/lib/recurrence/parser";

describe("recurrence/formatter yearly", () => {
  const yearly: RecurrencePattern = { rule: "year", interval: 1 };
  const everyThree: RecurrencePattern = { rule: "year", interval: 3 };

  it("summarises a yearly pattern", () => {
    expect(formatRecurrenceSummary(yearly)).toBe("Every year");
    expect(formatRecurrenceSummary(everyThree)).toBe("Every 3 years");
  });

  it("writes a yearly pattern as text that parses back to it", () => {
    for (const pattern of [yearly, everyThree]) {
      const text = formatRecurrenceAsText(pattern);

      expect(parseRecurrence(text, defaultRecurrenceConfig as RecurrenceConfig).recurrence).toEqual(
        pattern
      );
    }
  });
});
