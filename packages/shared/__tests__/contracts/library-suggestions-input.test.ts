import { describe, expect, it } from "vitest";

import {
  LibrarySuggestionsInputSchema,
  MAX_FILTER_INGREDIENTS,
  SUGGEST_TEXT_MAX,
} from "../../src/contracts/zod";

describe("LibrarySuggestionsInputSchema", () => {
  it("takes the longest text and rejects one character more", () => {
    expect(SUGGEST_TEXT_MAX).toBe(200);
    expect(LibrarySuggestionsInputSchema.safeParse({ text: "a".repeat(200) }).success).toBe(true);
    expect(LibrarySuggestionsInputSchema.safeParse({ text: "a".repeat(201) }).success).toBe(false);
  });

  it("takes the applied Ingredients and Tags to leave out, within the filter limit", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const parse = (exceptIngredientIds: string[], exceptTags: string[]) =>
      LibrarySuggestionsInputSchema.safeParse({ text: "ch", exceptIngredientIds, exceptTags });

    expect(LibrarySuggestionsInputSchema.parse({ text: "ch" })).toEqual({
      text: "ch",
      exceptIngredientIds: [],
      exceptTags: [],
    });
    expect(parse(Array(MAX_FILTER_INGREDIENTS).fill(id), ["soup"]).success).toBe(true);
    expect(parse(Array(MAX_FILTER_INGREDIENTS + 1).fill(id), []).success).toBe(false);
    expect(parse([], Array(MAX_FILTER_INGREDIENTS + 1).fill("soup")).success).toBe(false);
    expect(parse([], ["a".repeat(SUGGEST_TEXT_MAX + 1)]).success).toBe(false);
  });
});
