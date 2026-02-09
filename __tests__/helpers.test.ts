import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { describe, it, expect } from "vitest";

import {
  parseIsoDuration,
  formatMinutesHM,
  parseIngredientWithDefaults,
  stripHtmlTags,
  getWeekStart,
  getWeekEnd,
  getWeekDays,
  addWeeks,
} from "@/lib/helpers";

describe("parseIsoDuration", () => {
  it("parses hours and minutes", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
  });

  it("parses hours only", () => {
    expect(parseIsoDuration("PT2H")).toBe(120);
  });

  it("parses minutes only", () => {
    expect(parseIsoDuration("PT45M")).toBe(45);
  });

  it("returns undefined for invalid format", () => {
    expect(parseIsoDuration("invalid")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseIsoDuration("")).toBeUndefined();
  });
});

describe("formatMinutesHM", () => {
  it("formats minutes under an hour", () => {
    expect(formatMinutesHM(45)).toBe("45m");
  });

  it("formats exactly one hour", () => {
    expect(formatMinutesHM(60)).toBe("1:00h");
  });

  it("formats hours and minutes", () => {
    expect(formatMinutesHM(90)).toBe("1:30h");
  });

  it("pads minutes with zero", () => {
    expect(formatMinutesHM(65)).toBe("1:05h");
  });

  it("returns undefined for null", () => {
    expect(formatMinutesHM(undefined)).toBeUndefined();
  });

  it("returns undefined for negative", () => {
    expect(formatMinutesHM(-5)).toBeUndefined();
  });
});

describe("parseIngredientWithDefaults", () => {
  it("parses simple ingredient", () => {
    const result = parseIngredientWithDefaults("2 cups flour");

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].unitOfMeasure).toBe("cups");
    expect(result[0].description).toBe("flour");
  });

  it("parses ingredient without unit", () => {
    const result = parseIngredientWithDefaults("3 eggs");

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
    expect(result[0].description).toContain("egg");
  });

  it("parses array of ingredients", () => {
    const result = parseIngredientWithDefaults(["1 cup sugar", "2 tbsp butter"]);

    expect(result).toHaveLength(2);
  });

  it("handles empty input", () => {
    const result = parseIngredientWithDefaults("");

    expect(result).toHaveLength(0);
  });

  it("handles European comma decimals", () => {
    const result = parseIngredientWithDefaults("1,5 cups flour");

    expect(result[0].quantity).toBe(1.5);
  });

  it("parses and returns canonical unit IDs", () => {
    const result = parseIngredientWithDefaults("500 grams flour");

    // Returns canonical unit ID from parse-ingredient library
    expect(result[0].unitOfMeasureID).toBe("gram");
    expect(result[0].quantity).toBe(500);
  });

  it("parses custom units with locale-aware schema", () => {
    const customUnits: UnitsMap = {
      piece: {
        short: [{ locale: "en", name: "pc" }],
        plural: [{ locale: "en", name: "pcs" }],
        alternates: ["piece", "pieces", "pc", "pcs"],
      },
    };

    const result = parseIngredientWithDefaults("2 pieces apple", customUnits);

    // Parser returns canonical ID - display formatting happens at UI layer
    expect(result[0].unitOfMeasureID).toBe("piece");
    expect(result[0].quantity).toBe(2);
  });
});

describe("stripHtmlTags", () => {
  it("removes simple HTML tags", () => {
    expect(stripHtmlTags("<p>Hello</p>")).toBe("Hello");
  });

  it("removes multiple tags", () => {
    expect(stripHtmlTags("<b>Bold</b> and <i>italic</i>")).toBe("Bold and italic");
  });

  it("removes nested tags", () => {
    expect(stripHtmlTags("<div><p><span>Nested</span></p></div>")).toBe("Nested");
  });

  it("handles self-closing tags", () => {
    expect(stripHtmlTags("Line 1<br/>Line 2")).toBe("Line 1 Line 2");
  });

  it("decodes &nbsp;", () => {
    expect(stripHtmlTags("Hello&nbsp;World")).toBe("Hello World");
  });

  it("decodes &amp;", () => {
    expect(stripHtmlTags("Fish &amp; Chips")).toBe("Fish & Chips");
  });

  it("decodes &lt; and &gt;", () => {
    expect(stripHtmlTags("a &lt; b &gt; c")).toBe("a < b > c");
  });

  it("decodes &quot; and apostrophes", () => {
    expect(stripHtmlTags("&quot;test&quot; and &#39;test&#39;")).toBe("\"test\" and 'test'");
  });

  it("handles mixed content", () => {
    expect(stripHtmlTags("<p>Hello&nbsp;<b>World</b></p>")).toBe("Hello World");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtmlTags("Plain text")).toBe("Plain text");
  });

  it("handles empty string", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtmlTags("  <p>test</p>  ")).toBe("test");
  });

  it("collapses multiple spaces into one", () => {
    expect(stripHtmlTags("<p>too    many    spaces</p>")).toBe("too many spaces");
  });

  it("normalizes newlines and tabs to single space", () => {
    expect(stripHtmlTags("line1\n\nline2\t\ttab")).toBe("line1 line2 tab");
  });

  it("decodes numeric HTML entities (&#NNN;)", () => {
    expect(stripHtmlTags("&#169; 2024")).toBe("© 2024");
  });

  it("decodes hex HTML entities (&#xHH;)", () => {
    expect(stripHtmlTags("&#x2764;")).toBe("❤");
  });

  it("decodes smart quotes and special punctuation", () => {
    expect(stripHtmlTags("&ldquo;quoted&rdquo; &mdash; test")).toBe(
      "\u201Cquoted\u201D \u2014 test"
    );
  });

  it("handles mixed entities and HTML tags", () => {
    expect(stripHtmlTags("<p>&ldquo;Hello&nbsp;<b>World</b>&rdquo;</p>")).toBe(
      "\u201CHello World\u201D"
    );
  });
});

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday", () => {
    const wednesday = new Date(2024, 0, 3); // Jan 3, 2024 is Wednesday
    const monday = getWeekStart(wednesday);

    expect(monday.getDate()).toBe(1); // Jan 1, 2024 is Monday
  });

  it("returns same day for Monday", () => {
    const monday = new Date(2024, 0, 1);
    const result = getWeekStart(monday);

    expect(result.getDate()).toBe(1);
  });

  it("returns previous Monday for Sunday", () => {
    const sunday = new Date(2024, 0, 7); // Jan 7, 2024 is Sunday
    const monday = getWeekStart(sunday);

    expect(monday.getDate()).toBe(1); // Previous Monday is Jan 1
  });
});

describe("getWeekEnd", () => {
  it("returns Sunday of the same week", () => {
    const monday = new Date(2024, 0, 1);
    const sunday = getWeekEnd(monday);

    expect(sunday.getDate()).toBe(7); // Jan 7, 2024 is Sunday
  });
});

describe("getWeekDays", () => {
  it("returns exactly 7 days", () => {
    const monday = new Date(2024, 0, 1);
    const days = getWeekDays(monday);

    expect(days).toHaveLength(7);
  });

  it("starts with Monday and ends with Sunday", () => {
    const wednesday = new Date(2024, 0, 3);
    const days = getWeekDays(wednesday);

    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
  });
});

describe("addWeeks", () => {
  it("adds one week", () => {
    const date = new Date(2024, 0, 1);
    const result = addWeeks(date, 1);

    expect(result.getDate()).toBe(8);
  });

  it("subtracts one week", () => {
    const date = new Date(2024, 0, 15);
    const result = addWeeks(date, -1);

    expect(result.getDate()).toBe(8);
  });

  it("handles month boundary", () => {
    const date = new Date(2024, 0, 29); // Jan 29
    const result = addWeeks(date, 1);

    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(5);
  });
});
