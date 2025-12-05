import { describe, it, expect } from "vitest";

import {
  parseIsoDuration,
  formatMinutesHM,
  parseIngredientWithDefaults,
  stripHtmlTags,
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

  it("parses with custom units", () => {
    const customUnits = {
      stuk: { short: "st", plural: "stuks", alternates: [] },
    };
    const result = parseIngredientWithDefaults("2 stuk appel", customUnits);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it("handles reordering for better parsing", () => {
    // Test case where unit comes after description
    const customUnits = {
      gram: { short: "g", plural: "grams", alternates: [] },
    };
    const result = parseIngredientWithDefaults("flour 500g", customUnits);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(500);
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
    expect(stripHtmlTags("Salt &amp; Pepper")).toBe("Salt & Pepper");
  });

  it("decodes &lt; and &gt;", () => {
    expect(stripHtmlTags("&lt;tag&gt;")).toBe("<tag>");
  });

  it("decodes &quot; and apostrophes", () => {
    expect(stripHtmlTags("&quot;quoted&quot; and &#39;apostrophe&#39;")).toBe(
      "\"quoted\" and 'apostrophe'"
    );
  });

  it("handles mixed content", () => {
    expect(stripHtmlTags("<b>Salt</b> &amp; <i>Pepper</i>")).toBe("Salt & Pepper");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtmlTags("Just plain text")).toBe("Just plain text");
  });

  it("handles empty string", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtmlTags("  hello world  ")).toBe("hello world");
  });

  it("collapses multiple spaces into one", () => {
    expect(stripHtmlTags("hello    world")).toBe("hello world");
  });

  it("normalizes newlines and tabs to single space", () => {
    expect(stripHtmlTags("hello\n\nworld\tthere")).toBe("hello world there");
  });

  it("decodes numeric HTML entities (&#NNN;)", () => {
    expect(stripHtmlTags("&#248;")).toBe("ø");
    expect(stripHtmlTags("caf&#233;")).toBe("café");
    expect(stripHtmlTags("R&#248;dgr&#248;d med fl&#248;de")).toBe("Rødgrød med fløde");
  });

  it("decodes hex HTML entities (&#xHH;)", () => {
    expect(stripHtmlTags("&#xF8;")).toBe("ø");
    expect(stripHtmlTags("&#xe9;")).toBe("é");
  });

  it("decodes smart quotes and special punctuation", () => {
    expect(stripHtmlTags("&#8220;Hello&#8221;")).toBe("\u201CHello\u201D");
    expect(stripHtmlTags("It&#8217;s")).toBe("It\u2019s");
    expect(stripHtmlTags("180&#176;C")).toBe("180°C");
  });

  it("handles mixed entities and HTML tags", () => {
    expect(stripHtmlTags("<b>Sm&#248;rrebr&#248;d</b>")).toBe("Smørrebrød");
    expect(stripHtmlTags("<p>Bake at 180&#176;C for 30 minutes</p>")).toBe(
      "Bake at 180°C for 30 minutes"
    );
  });
});
