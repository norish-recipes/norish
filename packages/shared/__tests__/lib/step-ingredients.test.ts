import { describe, expect, it } from "vitest";

import {
  deriveStepIngredientAmount,
  resolveStepIngredients,
} from "@norish/shared/lib/step-ingredients";

const METRIC_LINES = [
  { ingredientName: "water", amount: 50, unit: "ml", systemUsed: "metric", order: 0 },
  { ingredientName: "salt", amount: null, unit: null, systemUsed: "metric", order: 1 },
  { ingredientName: "# For the sauce", amount: null, unit: null, systemUsed: "metric", order: 2 },
  { ingredientName: "flour", amount: 300, unit: "g", systemUsed: "metric", order: 3 },
];

const US_LINES = [
  { ingredientName: "water", amount: 0.25, unit: "cup", systemUsed: "us", order: 0 },
  { ingredientName: "salt", amount: 1, unit: "tsp", systemUsed: "us", order: 1 },
];

describe("deriveStepIngredientAmount", () => {
  it("multiplies the line's current amount by the share", () => {
    expect(deriveStepIngredientAmount(50, 0.5)).toBe(25);
    expect(deriveStepIngredientAmount(300, 1)).toBe(300);
  });

  it("rounds a repeating fraction instead of trailing a float tail", () => {
    // A third of 50 — the arithmetic the cook no longer does mid-cook.
    expect(deriveStepIngredientAmount(50, 1 / 3)).toBe(16.6667);
    expect(deriveStepIngredientAmount(1, 0.1)).toBe(0.1);
  });

  it("keeps an amountless line amountless", () => {
    expect(deriveStepIngredientAmount(null, 0.5)).toBeNull();
    expect(deriveStepIngredientAmount(undefined, 1)).toBeNull();
  });
});

describe("resolveStepIngredients", () => {
  it("resolves names and derived amounts from the live lines", () => {
    const resolved = resolveStepIngredients(
      [{ ingredientOrder: 0, share: 0.5, order: 0 }],
      METRIC_LINES,
      "metric"
    );

    expect(resolved).toEqual([
      { ingredientOrder: 0, name: "water", amount: 25, unit: "ml", share: 0.5 },
    ]);
  });

  it("shows the name only when the line has no amount", () => {
    const resolved = resolveStepIngredients(
      [{ ingredientOrder: 1, share: 1, order: 0 }],
      METRIC_LINES,
      "metric"
    );

    expect(resolved).toEqual([
      { ingredientOrder: 1, name: "salt", amount: null, unit: null, share: 1 },
    ]);
  });

  it("resolves an aggregate step to every line it references, in reference order", () => {
    const resolved = resolveStepIngredients(
      [
        { ingredientOrder: 3, share: 1, order: 1 },
        { ingredientOrder: 0, share: 1, order: 0 },
      ],
      METRIC_LINES,
      "metric"
    );

    expect(resolved.map((item) => item.name)).toEqual(["water", "flour"]);
  });

  it("resolves strictly within the step's measurement system", () => {
    const refs = [{ ingredientOrder: 0, share: 0.5, order: 0 }];

    expect(resolveStepIngredients(refs, [...METRIC_LINES, ...US_LINES], "metric")[0]).toMatchObject(
      { amount: 25, unit: "ml" }
    );
    expect(resolveStepIngredients(refs, [...METRIC_LINES, ...US_LINES], "us")[0]).toMatchObject({
      amount: 0.125,
      unit: "cup",
    });
  });

  it("follows an edit to the line's amount without the reference changing", () => {
    const refs = [{ ingredientOrder: 0, share: 0.5, order: 0 }];
    const edited = METRIC_LINES.map((line) => (line.order === 0 ? { ...line, amount: 80 } : line));

    expect(resolveStepIngredients(refs, edited, "metric")[0]?.amount).toBe(40);
  });

  it("never resolves a reference onto a heading row", () => {
    const resolved = resolveStepIngredients(
      [{ ingredientOrder: 2, share: 1, order: 0 }],
      METRIC_LINES,
      "metric"
    );

    expect(resolved).toEqual([]);
  });

  it("drops a reference whose line no longer exists", () => {
    const resolved = resolveStepIngredients(
      [{ ingredientOrder: 9, share: 1, order: 0 }],
      METRIC_LINES,
      "metric"
    );

    expect(resolved).toEqual([]);
  });
});
