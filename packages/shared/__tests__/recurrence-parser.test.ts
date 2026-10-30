import { describe, expect, it } from "vitest";

import type { RecurrenceConfig } from "@norish/shared/contracts/recurrence";
import defaultRecurrenceConfig from "@norish/config/recurrence-config.default.json";
import { parseRecurrence } from "@norish/shared/lib/recurrence/parser";

describe("recurrence/parser Korean locale", () => {
  const config = defaultRecurrenceConfig as RecurrenceConfig;

  it("parses daily Korean recurrence phrase", () => {
    const result = parseRecurrence("우유 사기 매일", config);

    expect(result.recurrence).toEqual({
      rule: "day",
      interval: 1,
      weekday: undefined,
    });
    expect(result.matchedLocale).toBe("ko");
    expect(result.cleanText).toBe("우유 사기");
  });

  it("parses weekly Korean recurrence with weekday", () => {
    const result = parseRecurrence("요가 매주 화요일", config);

    expect(result.recurrence).toEqual({
      rule: "week",
      interval: 1,
      weekday: 2,
    });
    expect(result.matchedLocale).toBe("ko");
    expect(result.cleanText).toBe("요가");
  });

  it("parses biweekly Korean recurrence", () => {
    const result = parseRecurrence("요가 격주", config);

    expect(result.recurrence).toEqual({
      rule: "week",
      interval: 2,
    });
    expect(result.matchedLocale).toBe("ko");
    expect(result.cleanText).toBe("요가");
  });

  it("parses bimonthly Korean recurrence", () => {
    const result = parseRecurrence("청소 격월", config);

    expect(result.recurrence).toEqual({
      rule: "month",
      interval: 2,
    });
    expect(result.matchedLocale).toBe("ko");
    expect(result.cleanText).toBe("청소");
  });
});

describe("recurrence/parser Germanic locales", () => {
  const config = defaultRecurrenceConfig as RecurrenceConfig;

  it("parses English daily recurrence", () => {
    const result = parseRecurrence("Buy milk every day", config);

    expect(result.recurrence).toEqual({
      rule: "day",
      interval: 1,
      weekday: undefined,
    });
    expect(result.matchedLocale).toBe("en");
    expect(result.cleanText).toBe("Buy milk");
  });

  it("parses English biweekly recurrence with weekday", () => {
    const result = parseRecurrence("Gym every other week on monday", config);

    expect(result.recurrence).toEqual({
      rule: "week",
      interval: 2,
      weekday: 1,
    });
    expect(result.matchedLocale).toBe("en");
    expect(result.cleanText).toBe("Gym");
  });

  it("reads a day on a weekday as that weekday each week", () => {
    const result = parseRecurrence("Bread every day on friday", config);

    expect(result.recurrence).toEqual({ rule: "week", interval: 1, weekday: 5 });
    expect(result.cleanText).toBe("Bread");
  });

  it("parses Dutch weekly recurrence with weekday", () => {
    const result = parseRecurrence("Sport elke week op dinsdag", config);

    expect(result.recurrence).toEqual({
      rule: "week",
      interval: 1,
      weekday: 2,
    });
    expect(result.matchedLocale).toBe("nl");
    expect(result.cleanText).toBe("Sport");
  });

  it("parses Dutch interval hints", () => {
    const result = parseRecurrence("Yoga om de week", config);

    expect(result.recurrence).toEqual({
      rule: "week",
      interval: 2,
    });
    expect(result.matchedLocale).toBe("nl");
    expect(result.cleanText).toBe("Yoga");
  });
});

describe("recurrence/parser Latin locales", () => {
  const config = defaultRecurrenceConfig as RecurrenceConfig;

  it("parses Spanish weekly recurrence", () => {
    const result = parseRecurrence("Comprar pan cada semana", config);

    expect(result.recurrence?.rule).toBe("week");
    expect(result.recurrence?.interval).toBe(1);
    expect(result.recurrence?.weekday).toBe(new Date().getDay());
    expect(result.matchedLocale).toBe("es");
    expect(result.cleanText).toBe("Comprar pan");
  });

  it("parses French weekly recurrence", () => {
    const result = parseRecurrence("Acheter du lait chaque semaine", config);

    expect(result.recurrence?.rule).toBe("week");
    expect(result.recurrence?.interval).toBe(1);
    expect(result.recurrence?.weekday).toBe(new Date().getDay());
    expect(result.matchedLocale).toBe("fr");
    expect(result.cleanText).toBe("Acheter du lait");
  });
});

describe("recurrence/parser Ukrainian locale", () => {
  const config = defaultRecurrenceConfig as RecurrenceConfig;

  it("parses a one-word daily phrase", () => {
    const result = parseRecurrence("Купити хліб щодня", config);

    expect(result.recurrence).toEqual({ rule: "day", interval: 1 });
    expect(result.matchedLocale).toBe("uk");
    expect(result.cleanText).toBe("Купити хліб");
  });

  it("parses a one-word weekly phrase", () => {
    const result = parseRecurrence("молоко щотижня", config);

    expect(result.recurrence).toEqual({ rule: "week", interval: 1 });
    expect(result.matchedLocale).toBe("uk");
    expect(result.cleanText).toBe("молоко");
  });

  it("parses an interval with a number", () => {
    const result = parseRecurrence("Кава кожні 2 тижні", config);

    expect(result.recurrence?.rule).toBe("week");
    expect(result.recurrence?.interval).toBe(2);
    expect(result.matchedLocale).toBe("uk");
    expect(result.cleanText).toBe("Кава");
  });

  it("parses a weekday in the genitive", () => {
    const result = parseRecurrence("Йога кожного понеділка", config);

    expect(result.recurrence).toEqual({ rule: "week", interval: 1, weekday: 1 });
    expect(result.matchedLocale).toBe("uk");
    expect(result.cleanText).toBe("Йога");
  });

  it("parses a weekday in the accusative", () => {
    const result = parseRecurrence("Риба кожну п’ятницю", config);

    expect(result.recurrence).toEqual({ rule: "week", interval: 1, weekday: 5 });
    expect(result.cleanText).toBe("Риба");
  });

  it("parses a weekday with an apostrophe in any spelling", () => {
    const typographic = parseRecurrence("Риба кожної п’ятниці", config);
    const ascii = parseRecurrence("Риба кожної п'ятниці", config);
    const modifierLetter = parseRecurrence("Риба кожної пʼятниці", config);

    expect(typographic.recurrence).toEqual({ rule: "week", interval: 1, weekday: 5 });
    expect(ascii.recurrence).toEqual({ rule: "week", interval: 1, weekday: 5 });
    expect(modifierLetter.recurrence).toEqual({ rule: "week", interval: 1, weekday: 5 });
  });

  it("parses once a week and every other week", () => {
    const weekly = parseRecurrence("Прибирання раз на тиждень", config);
    const everyOther = parseRecurrence("Прибирання раз на два тижні", config);

    expect(weekly.recurrence).toEqual({ rule: "week", interval: 1 });
    expect(everyOther.recurrence).toEqual({ rule: "week", interval: 2 });
    expect(everyOther.cleanText).toBe("Прибирання");
  });

  it("reads “через тиждень” as “in a week”, not as a repeat", () => {
    expect(parseRecurrence("Ліки через тиждень", config).recurrence).toBeNull();
  });
});

describe("recurrence/parser yearly", () => {
  const config = defaultRecurrenceConfig as RecurrenceConfig;

  it.each([
    ["waterfilter yearly", "en", 1],
    ["waterfilter every year", "en", 1],
    ["waterfilter every 2 years", "en", 2],
    ["waterfilter jaarlijks", "nl", 1],
    ["waterfilter elk jaar", "nl", 1],
    ["waterfilter 매년", "ko", 1],
    ["waterfilter cada año", "es", 1],
    ["waterfilter hvert år", "da", 1],
    ["waterfilter chaque année", "fr", 1],
    ["waterfilter ogni anno", "it", 1],
    ["waterfilter щороку", "uk", 1],
    ["waterfilter кожен рік", "uk", 1],
  ])("parses %s", (text, locale, interval) => {
    const result = parseRecurrence(text, config);

    expect(result.recurrence).toMatchObject({ rule: "year", interval });
    expect(result.matchedLocale).toBe(locale);
    expect(result.cleanText).toBe("waterfilter");
  });

  it("has a year's unit words in every locale", () => {
    for (const locale of Object.values(config.locales)) {
      expect(locale.unitWords.year.length).toBeGreaterThan(0);
    }
  });
});

describe("recurrence/parser German, Polish, Russian, Finnish, Norwegian, Bulgarian, Portuguese, Swedish and Arabic", () => {
  const config = defaultRecurrenceConfig as RecurrenceConfig;

  it.each([
    ["melk jeden Tag", "de", { rule: "day", interval: 1 }],
    ["melk jede Woche am Montag", "de", { rule: "week", interval: 1, weekday: 1 }],
    ["melk alle 2 Wochen", "de", { rule: "week", interval: 2 }],
    ["melk täglich", "de", { rule: "day", interval: 1 }],
    ["melk jedes Jahr", "de", { rule: "year", interval: 1 }],
    ["melk codziennie", "pl", { rule: "day", interval: 1 }],
    ["melk co tydzień w poniedziałek", "pl", { rule: "week", interval: 1, weekday: 1 }],
    ["melk co roku", "pl", { rule: "year", interval: 1 }],
    ["melk каждый день", "ru", { rule: "day", interval: 1 }],
    ["melk каждую неделю в понедельник", "ru", { rule: "week", interval: 1, weekday: 1 }],
    ["melk ежегодно", "ru", { rule: "year", interval: 1 }],
    ["melk joka päivä", "fi", { rule: "day", interval: 1 }],
    ["melk joka viikko maanantaina", "fi", { rule: "week", interval: 1, weekday: 1 }],
    ["melk vuosittain", "fi", { rule: "year", interval: 1 }],
    ["melk hver uke på mandag", "no", { rule: "week", interval: 1, weekday: 1 }],
    ["melk daglig", "no", { rule: "day", interval: 1 }],
    ["melk årlig", "no", { rule: "year", interval: 1 }],
    ["melk всеки ден", "bg", { rule: "day", interval: 1 }],
    ["melk всяка седмица в понеделник", "bg", { rule: "week", interval: 1, weekday: 1 }],
    ["melk всяка година", "bg", { rule: "year", interval: 1 }],
    ["melk todo dia", "pt", { rule: "day", interval: 1 }],
    ["melk toda semana na segunda", "pt", { rule: "week", interval: 1, weekday: 1 }],
    ["melk todos os anos", "pt", { rule: "year", interval: 1 }],
    ["melk varje dag", "sv", { rule: "day", interval: 1 }],
    ["melk varje vecka på måndag", "sv", { rule: "week", interval: 1, weekday: 1 }],
    ["melk var tredje dag", "sv", { rule: "day", interval: 3 }],
    ["melk varannan vecka", "sv", { rule: "week", interval: 2 }],
    ["melk årligen", "sv", { rule: "year", interval: 1 }],
    ["melk كل يوم", "ar", { rule: "day", interval: 1 }],
    ["melk كل أسبوع يوم الاثنين", "ar", { rule: "week", interval: 1, weekday: 1 }],
    ["melk كل جمعة", "ar", { rule: "week", interval: 1, weekday: 5 }],
    ["melk كل يوم جمعة", "ar", { rule: "week", interval: 1, weekday: 5 }],
    ["melk كل 3 أيام", "ar", { rule: "day", interval: 3 }],
    ["melk كل أسبوعين", "ar", { rule: "week", interval: 2 }],
    ["melk شهريًا", "ar", { rule: "month", interval: 1 }],
    ["melk كل سنة", "ar", { rule: "year", interval: 1 }],
    // Spanish is read first and knows "a cada" too, so nothing is left behind.
    ["melk a cada 2 semanas", "es", { rule: "week", interval: 2 }],
  ])("parses %s", (text, locale, pattern) => {
    const result = parseRecurrence(text, config);

    expect(result.recurrence).toMatchObject(pattern);
    expect(result.matchedLocale).toBe(locale);
    expect(result.cleanText).toBe("melk");
  });
});
