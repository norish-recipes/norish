import { describe, expect, it } from "vitest";

import { LibrarySuggestionsInputSchema, SUGGEST_TEXT_MAX } from "../../src/contracts/zod";

describe("LibrarySuggestionsInputSchema", () => {
  it("takes the longest text and rejects one character more", () => {
    expect(SUGGEST_TEXT_MAX).toBe(200);
    expect(LibrarySuggestionsInputSchema.safeParse({ text: "a".repeat(200) }).success).toBe(true);
    expect(LibrarySuggestionsInputSchema.safeParse({ text: "a".repeat(201) }).success).toBe(false);
  });
});
