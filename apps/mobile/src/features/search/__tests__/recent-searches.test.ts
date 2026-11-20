import { describe, expect, it } from "vitest";

import { addRecent, parseRecents, RECENT_LIMIT } from "../utils/recent-searches";

describe("addRecent", () => {
  it("puts the newest first", () => {
    expect(addRecent(["tacos"], "pizza")).toEqual(["pizza", "tacos"]);
  });

  it("trims, and ignores blank text", () => {
    expect(addRecent(["tacos"], "  pizza ")).toEqual(["pizza", "tacos"]);
    expect(addRecent(["tacos"], "   ")).toEqual(["tacos"]);
  });

  it("saves no text without search words", () => {
    expect(addRecent(["tacos"], "-")).toEqual(["tacos"]);
    expect(addRecent(["tacos"], " ^ ! ")).toEqual(["tacos"]);
  });

  it("moves a repeat to the top in any case, with the latest spelling", () => {
    expect(addRecent(["pizza", "Tacos", "soup"], "tacos ")).toEqual(["tacos", "pizza", "soup"]);
  });

  it("keeps the newest ten", () => {
    const full = Array.from({ length: RECENT_LIMIT }, (_, index) => `search ${index}`);
    const next = addRecent(full, "new");

    expect(next).toHaveLength(RECENT_LIMIT);
    expect(next[0]).toBe("new");
    expect(next).not.toContain("search 9");
  });
});

describe("parseRecents", () => {
  it("reads only texts, without repeats, newest first, within the limit", () => {
    expect(parseRecents(["a", 3, "B", "b", null, "c"])).toEqual(["a", "B", "c"]);
    expect(parseRecents(Array.from({ length: 30 }, (_, index) => `s${index}`))).toHaveLength(
      RECENT_LIMIT
    );
  });

  it("reads anything else as empty", () => {
    expect(parseRecents(undefined)).toEqual([]);
    expect(parseRecents("tacos")).toEqual([]);
  });
});
