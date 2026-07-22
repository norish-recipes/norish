import { describe, expect, it } from "vitest";

import type { GroceryMergeCandidate } from "@norish/shared/lib/grocery-merge";
import {
  accumulateGroceryAmounts,
  buildGroceryMergeIndex,
  findGroceryMergeTarget,
  groceryMergeKey,
  normalizeGroceryName,
  unitsAreMergeCompatible,
} from "@norish/shared/lib/grocery-merge";

function candidate(overrides: Partial<GroceryMergeCandidate> = {}): GroceryMergeCandidate {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Milk",
    unit: null,
    amount: 1,
    isDone: false,
    recipeIngredientId: null,
    recurringGroceryId: null,
    ...overrides,
  };
}

describe("normalizeGroceryName", () => {
  it("lowercases and trims", () => {
    expect(normalizeGroceryName("  Whole Milk ")).toBe("whole milk");
  });

  it("maps null and undefined to the empty string", () => {
    expect(normalizeGroceryName(null)).toBe("");
    expect(normalizeGroceryName(undefined)).toBe("");
  });
});

describe("groceryMergeKey", () => {
  it("keys by normalized name with manual origin defaults", () => {
    expect(groceryMergeKey({ name: " Milk " })).toBe("milk|manual|none");
  });

  it("separates recipe-sourced and recurring origins", () => {
    expect(groceryMergeKey({ name: "Milk", recipeIngredientId: "ri-1" })).toBe("milk|ri-1|none");
    expect(groceryMergeKey({ name: "Milk", recurringGroceryId: "rg-1" })).toBe("milk|manual|rg-1");
  });

  it("returns null for unnamed groceries", () => {
    expect(groceryMergeKey({ name: null })).toBeNull();
    expect(groceryMergeKey({ name: "   " })).toBeNull();
  });
});

describe("unitsAreMergeCompatible", () => {
  it("requires exact unit equality", () => {
    expect(unitsAreMergeCompatible("g", "g")).toBe(true);
    expect(unitsAreMergeCompatible("g", "kg")).toBe(false);
  });

  it("treats null and empty string as the same empty unit", () => {
    expect(unitsAreMergeCompatible(null, null)).toBe(true);
    expect(unitsAreMergeCompatible("", null)).toBe(true);
    expect(unitsAreMergeCompatible(null, "")).toBe(true);
    expect(unitsAreMergeCompatible("g", null)).toBe(false);
    expect(unitsAreMergeCompatible(null, "g")).toBe(false);
  });
});

describe("accumulateGroceryAmounts", () => {
  it("adds amounts", () => {
    expect(accumulateGroceryAmounts(2, 3)).toBe(5);
  });

  it("defaults missing amounts to 1", () => {
    expect(accumulateGroceryAmounts(null, null)).toBe(2);
    expect(accumulateGroceryAmounts(null, 3)).toBe(4);
    expect(accumulateGroceryAmounts(2.5, null)).toBe(3.5);
  });
});

describe("buildGroceryMergeIndex", () => {
  it("indexes the first not-done candidate per key", () => {
    const first = candidate({ id: "a".repeat(36) });
    const second = candidate({ id: "b".repeat(36) });
    const index = buildGroceryMergeIndex([first, second]);

    expect(index.get("milk|manual|none")).toBe(first);
  });

  it("skips done and unnamed candidates", () => {
    const done = candidate({ isDone: true });
    const unnamed = candidate({ name: "  " });
    const index = buildGroceryMergeIndex([done, unnamed]);

    expect(index.size).toBe(0);
  });
});

describe("findGroceryMergeTarget", () => {
  it("finds a candidate with a matching key and compatible unit", () => {
    const existing = candidate({ unit: "l", amount: 1 });
    const index = buildGroceryMergeIndex([existing]);

    expect(findGroceryMergeTarget(index, { name: "milk", unit: "l", amount: 2 })).toBe(existing);
  });

  it("rejects unit-incompatible candidates", () => {
    const existing = candidate({ unit: "l" });
    const index = buildGroceryMergeIndex([existing]);

    expect(findGroceryMergeTarget(index, { name: "milk", unit: null, amount: 2 })).toBeNull();
  });

  it("rejects different origins for the same name", () => {
    const existing = candidate({ recipeIngredientId: "ri-1" });
    const index = buildGroceryMergeIndex([existing]);

    expect(findGroceryMergeTarget(index, { name: "milk", unit: null, amount: 1 })).toBeNull();
  });

  it("returns null for unnamed input", () => {
    const index = buildGroceryMergeIndex([candidate()]);

    expect(findGroceryMergeTarget(index, { name: null, unit: null, amount: 1 })).toBeNull();
  });
});
