import { describe, expect, it } from "vitest";

import { clampStep, resolveCookingModeSteps } from "../cooking-mode-steps";

describe("resolveCookingModeSteps", () => {
  it("filters by measurement system and carries headings onto following steps", () => {
    const steps = resolveCookingModeSteps(
      [
        { step: "# Prep", systemUsed: "metric", order: 0 },
        { step: "Chop onions", systemUsed: "metric", order: 1 },
        { step: "Chop onion", systemUsed: "us", order: 2 },
        { step: "# Cook", systemUsed: "metric", order: 3 },
        { step: "Simmer for 10 minutes", systemUsed: "metric", order: 4 },
      ],
      "metric"
    );

    expect(steps).toMatchObject([
      {
        heading: "Prep",
        stepNumber: 1,
        text: "Chop onions",
      },
      {
        heading: "Cook",
        stepNumber: 2,
        text: "Simmer for 10 minutes",
      },
    ]);
  });

  it("sorts step images inline by image order", () => {
    const steps = resolveCookingModeSteps(
      [
        {
          step: "Fold the dough",
          systemUsed: "metric",
          order: 0,
          images: [
            { image: "/recipes/1/steps/second.jpg", order: 2 },
            { image: "/recipes/1/steps/first.jpg", order: 1 },
          ],
        },
      ],
      "metric"
    );

    expect(steps[0]?.images).toEqual([
      { image: "/recipes/1/steps/first.jpg", order: 1 },
      { image: "/recipes/1/steps/second.jpg", order: 2 },
    ]);
  });

  it("carries images from heading rows onto the following cooking step", () => {
    const steps = resolveCookingModeSteps(
      [
        {
          step: "# Prep",
          systemUsed: "metric",
          order: 0,
          images: [{ image: "/recipes/1/steps/prep.jpg", order: 0 }],
        },
        {
          step: "Chop onions",
          systemUsed: "metric",
          order: 1,
          images: [{ image: "/recipes/1/steps/chop.jpg", order: 1 }],
        },
      ],
      "metric"
    );

    expect(steps[0]?.images).toEqual([
      { image: "/recipes/1/steps/prep.jpg", order: 0 },
      { image: "/recipes/1/steps/chop.jpg", order: 1 },
    ]);
  });

  it("carries each step's Step Ingredients through resolution", () => {
    const steps = resolveCookingModeSteps(
      [
        {
          step: "Add half the water.",
          systemUsed: "metric",
          order: 0,
          stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
        },
        { step: "Serve.", systemUsed: "metric", order: 1 },
      ],
      "metric"
    );

    expect(steps[0]?.stepIngredients).toEqual([{ ingredientOrder: 0, share: 0.5, order: 0 }]);
    // A step that uses nothing stays bare rather than undefined.
    expect(steps[1]?.stepIngredients).toEqual([]);
  });
});

describe("clampStep", () => {
  it("keeps a step within the steps there are", () => {
    expect(clampStep(-1, 3)).toBe(0);
    expect(clampStep(5, 3)).toBe(2);
    expect(clampStep(1, 3)).toBe(1);
    expect(clampStep(4, 0)).toBe(0);
  });
});
