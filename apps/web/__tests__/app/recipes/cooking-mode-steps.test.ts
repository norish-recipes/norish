import { resolveCookingModeSteps } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-mode-steps";
import { describe, expect, it } from "vitest";

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
});
