import { describe, expect, it } from "vitest";

import { duplicateAisleName, sortAisles } from "@norish/shared/lib/aisles";

describe("duplicateAisleName", () => {
  it("finds the name a Store would hold twice, regardless of case or surrounding space", () => {
    expect(duplicateAisleName(["Zuivel", "Brood", " zuivel "])).toBe(" zuivel ");
    expect(duplicateAisleName(["Zuivel", "ZUIVEL"])).toBe("ZUIVEL");
  });

  it("finds nothing where every name is its own", () => {
    expect(duplicateAisleName(["Zuivel", "Brood", "Groente"])).toBeNull();
    expect(duplicateAisleName([])).toBeNull();
  });

  it("does not count the empty name still being typed", () => {
    expect(duplicateAisleName(["Zuivel", "", "  "])).toBeNull();
  });
});

describe("sortAisles", () => {
  it("puts a Store's aisles in the order the household walks them, leaving the input alone", () => {
    const aisles = [
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 0 },
    ];

    expect(sortAisles(aisles).map((aisle) => aisle.id)).toEqual(["a", "b"]);
    expect(aisles[0]?.id).toBe("b");
  });
});
