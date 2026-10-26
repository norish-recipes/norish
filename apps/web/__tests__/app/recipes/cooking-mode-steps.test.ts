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

  it("numbers steps after a heading from one and keeps their position in the list", () => {
    const steps = resolveCookingModeSteps(
      [
        { step: "# Dough", systemUsed: "metric", order: 0 },
        { step: "Mix", systemUsed: "metric", order: 1 },
      ],
      "metric"
    );

    expect(steps).toMatchObject([{ originalIndex: 1, stepNumber: 1, text: "Mix" }]);
  });
});

describe("resolveCookingModeSteps with linked recipes", () => {
  const doughLines = [
    { ingredientName: "flour", amount: 500, unit: "g", systemUsed: "metric", order: 0 },
  ];
  const starterSteps = [{ step: "Feed the starter", systemUsed: "metric", order: 0 }];
  const doughSteps = [
    { step: "# Mixing", systemUsed: "metric", order: 0 },
    { step: "Add the [Starter](id:starter)", systemUsed: "metric", order: 1 },
    {
      step: "Mix the flour",
      systemUsed: "metric",
      order: 2,
      stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
    },
    { step: "Mix the flour (us)", systemUsed: "us", order: 2 },
  ];
  const pizzaSteps = [
    { step: "# Base", systemUsed: "metric", order: 0 },
    { step: "Make the [Dough](id:dough)", systemUsed: "metric", order: 1 },
    { step: "Stretch it", systemUsed: "metric", order: 2 },
  ];
  const linked = {
    dough: {
      recipeId: "dough",
      recipeName: "Dough",
      depth: 1,
      systemUsed: "metric",
      ingredients: doughLines,
      steps: doughSteps,
    },
    starter: {
      recipeId: "starter",
      recipeName: "Starter",
      depth: 2,
      systemUsed: "metric",
      ingredients: [],
      steps: starterSteps,
    },
  };
  const linkedAfter = (step: { step: string }) =>
    step === pizzaSteps[1] ? [linked.dough] : step === doughSteps[1] ? [linked.starter] : [];

  it("cooks each linked recipe's steps right after the step that links it, at any depth", () => {
    const steps = resolveCookingModeSteps(pizzaSteps, "metric", linkedAfter);

    expect(
      steps.map((step) => [step.stepNumber, step.text, step.linkedFrom?.recipeName ?? null])
    ).toEqual([
      [1, "Make the [Dough](id:dough)", null],
      [2, "Add the [Starter](id:starter)", "Dough"],
      [3, "Feed the starter", "Starter"],
      [4, "Mix the flour", "Dough"],
      [5, "Stretch it", null],
    ]);
  });

  it("scopes headings to the recipe they are written in", () => {
    const steps = resolveCookingModeSteps(pizzaSteps, "metric", linkedAfter);

    expect(steps.map((step) => step.heading)).toEqual([
      "Base",
      "Mixing",
      undefined,
      "Mixing",
      "Base",
    ]);
  });

  it("carries what a linked step needs to read: its recipe, lines, system and own index", () => {
    const steps = resolveCookingModeSteps(pizzaSteps, "metric", linkedAfter);
    const mix = steps.find((step) => step.text === "Mix the flour");

    expect(mix).toMatchObject({
      originalIndex: 2,
      stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
      linkedFrom: {
        recipeId: "dough",
        recipeName: "Dough",
        depth: 1,
        systemUsed: "metric",
        ingredients: doughLines,
      },
    });
    // The recipe being cooked's own steps carry no linked origin at all.
    expect(steps[0]).not.toHaveProperty("linkedFrom");
  });

  it("leaves out a step that only names the linked recipes following it", () => {
    const sauceSteps = [{ step: "Simmer", systemUsed: "metric", order: 0 }];
    const steps = [
      { step: "Fry", systemUsed: "metric", order: 0 },
      { step: "[Sauce](id:sauce)", systemUsed: "metric", order: 1 },
      { step: "Serve", systemUsed: "metric", order: 2 },
    ];
    const resolved = resolveCookingModeSteps(
      steps,
      "metric",
      (step) =>
        step === steps[1]
          ? [
              {
                recipeId: "sauce",
                recipeName: "Sauce",
                depth: 1,
                systemUsed: "metric",
                ingredients: [],
                steps: sauceSteps,
              },
            ]
          : [],
      (step) => step === steps[1]
    );

    expect(
      resolved.map((step) => [step.stepNumber, step.text, step.linkedFrom?.recipeName ?? null])
    ).toEqual([
      [1, "Fry", null],
      [2, "Simmer", "Sauce"],
      [3, "Serve", null],
    ]);
  });
});
