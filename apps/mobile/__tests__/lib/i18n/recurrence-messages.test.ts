import { readFileSync } from "node:fs";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { LOCALE_CATALOG } from "@norish/i18n/locales";
import {
  formatRecurrenceSummary,
  recurrenceTranslationsFrom,
} from "@norish/shared/lib/recurrence/formatter";

const MESSAGES = new URL("../../../../../packages/i18n/src/messages/", import.meta.url);

/** A repeat as the app reads it in `locale`, through react-intl and the shipped messages. */
function labelIn(locale: string) {
  const common = JSON.parse(readFileSync(new URL(`${locale}/common.json`, MESSAGES), "utf8"));
  const messages: Record<string, string> = {};

  for (const [key, value] of Object.entries(common.recurrence)) {
    if (typeof value === "string") messages[`common.recurrence.${key}`] = value;
  }
  for (const [day, name] of Object.entries(common.recurrence.weekdaysFull as object)) {
    messages[`common.recurrence.weekdaysFull.${day}`] = String(name);
  }
  const intl = createIntl({
    locale,
    messages,
    onError: (error) => {
      throw error;
    },
  });
  const words = recurrenceTranslationsFrom((key, values) =>
    intl.formatMessage({ id: `common.recurrence.${key}` }, values)
  );

  return (pattern: RecurrencePattern) => formatRecurrenceSummary(pattern, words);
}

const RULES = ["day", "week", "month", "year"] as const;

describe("recurrence messages", () => {
  it.each(Object.keys(LOCALE_CATALOG))("%s reads every interval of every rule", (locale) => {
    const label = labelIn(locale);

    for (const rule of RULES) {
      const [once, other, ...counted] = [1, 2, 3, 4, 5, 11, 21, 22, 25, 100].map((interval) =>
        label({ rule, interval, weekday: 5 })
      );

      expect(new Set([once, other, counted[0]]).size).toBe(3);
      counted.forEach((text, index) =>
        expect(text).toContain(String([3, 4, 5, 11, 21, 22, 25, 100][index]))
      );
      [once, other, ...counted].forEach((text) => expect(text).not.toMatch(/[{}#]/));
    }
  });

  it("says every other in the singular", () => {
    expect(labelIn("en")({ rule: "week", interval: 2, weekday: 5 })).toBe(
      "Every other week on Friday"
    );
    expect(labelIn("en")({ rule: "day", interval: 3 })).toBe("Every 3 days");
    expect(labelIn("nl")({ rule: "week", interval: 2, weekday: 5 })).toBe("Om de week op vrijdag");
    expect(labelIn("nl")({ rule: "year", interval: 1 })).toBe("Elk jaar");
    expect(labelIn("de-formal")({ rule: "month", interval: 2 })).toBe("Jeden zweiten Monat");
  });

  it("counts in the language's own plural forms", () => {
    const ru = labelIn("ru");
    const pl = labelIn("pl");

    expect([3, 5, 21].map((interval) => ru({ rule: "week", interval }))).toEqual([
      "Раз в 3 недели",
      "Раз в 5 недель",
      "Раз в 21 неделю",
    ]);
    expect([3, 5, 22].map((interval) => pl({ rule: "week", interval }))).toEqual([
      "Co 3 tygodnie",
      "Co 5 tygodni",
      "Co 22 tygodnie",
    ]);
  });

  it("names the weekday a repeat falls on", () => {
    expect(labelIn("da")({ rule: "week", interval: 1, weekday: 5 })).toBe("Hver uge på Fredag");
    expect(labelIn("no")({ rule: "week", interval: 1, weekday: 0 })).toBe("Hver uke på Søndag");
  });
});
