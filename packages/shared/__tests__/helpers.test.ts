import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import defaultUnits from "@norish/config/units.default.json";
import {
  addWeeks,
  avatarFilenameFromImagePath,
  buildAvatarFilename,
  formatMinutesHM,
  getWeekDays,
  getWeekEnd,
  getWeekStart,
  hasRecipeName,
  hasRecipeNameIngredientsAndSteps,
  isAvatarFilenameForUser,
  parseIngredientWithDefaults,
  parseIsoDuration,
  stripHtmlTags,
} from "@norish/shared/lib/helpers";

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

describe("recipe name helpers", () => {
  it("accepts recipes with only a name", () => {
    expect(
      hasRecipeName({
        name: "Fennel Tart",
        recipeIngredients: [],
        steps: [],
      } as any)
    ).toBe(true);
  });

  it("rejects recipes without a name", () => {
    expect(
      hasRecipeName({
        name: "   ",
        recipeIngredients: [{ description: "1 fennel bulb" }],
        steps: [{ text: "Bake until golden." }],
      } as any)
    ).toBe(false);
  });

  it("keeps the stricter helper requiring both ingredients and steps", () => {
    expect(
      hasRecipeNameIngredientsAndSteps({
        name: "Fennel Tart",
        recipeIngredients: [{ description: "1 fennel bulb" }],
        steps: [],
      } as any)
    ).toBe(false);
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

describe("parseIngredientWithDefaults keeps every word of a line (#635)", () => {
  const parse = (line: string) => parseIngredientWithDefaults(line, defaultUnits as UnitsMap)[0];
  const asWritten = (description: string) => ({
    quantity: null,
    unitOfMeasureID: null,
    description,
  });

  it("reads past a list marker, and drops a line that is only one", () => {
    expect(parse("• 2 uova")).toMatchObject({ quantity: 2, description: "uova" });
    expect(parse("●1 limone")).toMatchObject({ quantity: 1, description: "limone" });
    expect(parse("- sale e pepe")).toMatchObject(asWritten("sale e pepe"));
    expect(parseIngredientWithDefaults(["•", "2 uova"], defaultUnits as UnitsMap)).toHaveLength(1);
    expect(parse("•⚫3 peperoni")).toMatchObject({ quantity: 3, description: "peperoni" });
  });

  it('reads a "." before a digit as a marker in a list whose lines carry markers', () => {
    const list = parseIngredientWithDefaults(
      ["•2 uova", ".80 g di Pecorino", "• .5 l latte"],
      defaultUnits as UnitsMap
    );

    expect(list.map(({ quantity }) => quantity)).toEqual([2, 80, 0.5]);
    expect(parse(".5 cup milk")).toMatchObject({ quantity: 0.5 });
  });

  it("still reads an amount and unit written at the end", () => {
    expect(parse("Burro 20 g")).toMatchObject({
      quantity: 20,
      unitOfMeasureID: "gram",
      description: "Burro",
    });
    expect(parse("limoni 0,5")).toMatchObject({ quantity: 0.5, description: "limoni" });
  });

  it("keeps the word after an amount at the end of a line, and the amount so it scales", () => {
    expect(parse("Scorsa di 1 limone")).toMatchObject({
      quantity: 1,
      description: "Scorsa di limone",
    });
    expect(parse("patate dolci 4 grandi")).toMatchObject({
      quantity: 4,
      description: "patate dolci grandi",
    });
  });

  it("reads an amount written mid-line, with its unit, and leaves one in brackets", () => {
    expect(parse("patate 400 g lesse")).toMatchObject({
      quantity: 400,
      unitOfMeasureID: "gram",
      description: "patate lesse",
    });
    expect(parse("melanzane 3 medio grandi")).toMatchObject({
      quantity: 3,
      unitOfMeasureID: null,
      description: "melanzane medio grandi",
    });
    expect(parse("farina 00 50 g per infarinare")).toMatchObject({
      quantity: 50,
      unitOfMeasureID: "gram",
      description: "farina 00 per infarinare",
    });
    expect(parse("SPECK (50gr a persona)")).toMatchObject(asWritten("SPECK (50gr a persona)"));
    expect(parse("Crema: 150g Mascarpone")).toMatchObject({
      quantity: 150,
      unitOfMeasureID: "gram",
      description: "Crema: Mascarpone",
    });
    expect(parse("INGREDIENTI per 12 persone:")).toMatchObject(
      asWritten("INGREDIENTI per 12 persone:")
    );
  });

  it("reads a range as its lower end, a slash too unless it is a fraction", () => {
    expect(parse("2-3 rametti di menta")).toMatchObject({ quantity: 2 });
    expect(parse("10/15 pomodorini")).toMatchObject({ quantity: 10, description: "pomodorini" });
    expect(parse("1/2 limone")).toMatchObject({ quantity: 0.5 });
    expect(parse("2/3 tazza di burro")?.quantity).toBeCloseTo(0.667, 3);
  });

  it("keeps a zero amount without a unit as written, and drops one beside a unit", () => {
    expect(parse("farina 00")).toMatchObject(asWritten("farina 00"));
    expect(parse("0 to_taste Sale")).toMatchObject({
      quantity: null,
      unitOfMeasureID: "to_taste",
      description: "Sale",
    });
  });

  it("reads a unit without a number only where it means an amount", () => {
    expect(parse("q.b. sale")).toMatchObject({ unitOfMeasureID: "to_taste", description: "sale" });
    expect(parse("un pizzico di sale")).toMatchObject({ unitOfMeasureID: "pinch" });
    expect(parse("un po' di olio per ungere")).toMatchObject(
      asWritten("un po' di olio per ungere")
    );
    expect(parse("in una sola fetta")).toMatchObject(asWritten("in una sola fetta"));
  });

  it("never reads a unit that leaves no words", () => {
    expect(parse("Per decorare:")).toMatchObject({
      ...asWritten("Per decorare:"),
      isGroupHeader: true,
    });
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

describe("avatar filename helpers", () => {
  it("creates unique avatar filename using user id and timestamp", () => {
    expect(buildAvatarFilename("user-1", "png", 1735689600000)).toBe("user-1-1735689600000.png");
  });

  it("matches both legacy and versioned avatar filenames for a user", () => {
    expect(isAvatarFilenameForUser("user-1.png", "user-1")).toBe(true);
    expect(isAvatarFilenameForUser("user-1-1735689600000.png", "user-1")).toBe(true);
  });

  it("does not match filenames for different users", () => {
    expect(isAvatarFilenameForUser("user-10-1735689600000.png", "user-1")).toBe(false);
    expect(isAvatarFilenameForUser("other-user.png", "user-1")).toBe(false);
  });

  it("extracts the filename from an /avatars/ image path", () => {
    expect(avatarFilenameFromImagePath("/avatars/user-1-1735689600000.png")).toBe(
      "user-1-1735689600000.png"
    );
    expect(avatarFilenameFromImagePath("/avatars/user-1.webp")).toBe("user-1.webp");
  });

  it("returns null for external or missing image paths", () => {
    expect(avatarFilenameFromImagePath("https://example.com/photo.jpg")).toBeNull();
    expect(avatarFilenameFromImagePath(null)).toBeNull();
    expect(avatarFilenameFromImagePath(undefined)).toBeNull();
    expect(avatarFilenameFromImagePath("")).toBeNull();
  });

  it("rejects avatar paths with nested segments", () => {
    expect(avatarFilenameFromImagePath("/avatars/nested/file.png")).toBeNull();
  });
});
