import type { RecurrenceConfig } from "@/types/recurrence";

import { describe, it, expect } from "vitest";

import defaultRecurrenceConfig from "@/config/recurrence-config.default.json";
import { parseRecurrence } from "@/lib/recurrence/parser";

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
