import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import enCommon from "@norish/i18n/messages/en/common.json";
import ruCommon from "@norish/i18n/messages/ru/common.json";
import {
  formatRecurrenceSummary,
  recurrenceTranslationsFrom,
} from "@norish/shared/lib/recurrence/formatter";

/** A repeat as the recurrence pill reads it, through next-intl and the shipped messages. */
function labelIn(locale: string, common: typeof enCommon) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={{ common }}>
      {children}
    </NextIntlClientProvider>
  );
  const { result } = renderHook(() => useTranslations("common.recurrence"), { wrapper });
  const words = recurrenceTranslationsFrom(result.current);

  return (pattern: RecurrencePattern) => formatRecurrenceSummary(pattern, words);
}

describe("recurrence messages on web", () => {
  it("says every other in the singular, and counts the rest", () => {
    const en = labelIn("en", enCommon);

    expect(en({ rule: "week", interval: 2, weekday: 5 })).toBe("Every other week on Friday");
    expect(en({ rule: "month", interval: 1 })).toBe("Every month");
    expect(en({ rule: "day", interval: 4 })).toBe("Every 4 days");
  });

  it("counts in the language's own plural forms", () => {
    const ru = labelIn("ru", ruCommon);

    expect([2, 3, 5].map((interval) => ru({ rule: "year", interval }))).toEqual([
      "Раз в два года",
      "Раз в 3 года",
      "Раз в 5 лет",
    ]);
  });
});
