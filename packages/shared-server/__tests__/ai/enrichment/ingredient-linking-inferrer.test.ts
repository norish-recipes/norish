/**
 * Ingredient Linking inference.
 *
 * The AI Runtime is the single mocked AI seam — `generateStructured` and
 * `decide` — plus the loader's two questions, whether a Decision Model is
 * configured and whether a use of it is on, so Enrichment Validation runs
 * for real. What matters here is what the feature hands the runtime —
 * numbered lines and steps, headings withheld — and what survives coming
 * back: prompt numbers mapped onto row orders, invented numbers dropped, and
 * an empty claim returned as a valid answer rather than an error.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIDisabledError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import {
  isDecisionModelConfigured,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  decide: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
  decide: mocked.decide,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isDecisionModelConfigured: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { inferStepIngredients } =
  await import("@norish/shared-server/ai/enrichment/ingredient-linking-inferrer");

const RECIPE = {
  title: "Spiced Stew",
  ingredients: [
    { order: 0, text: "# Spices", amount: null, isHeading: true },
    { order: 1, text: "5 g salt", amount: 5, isHeading: false },
    { order: 2, text: "3 g pepper", amount: 3, isHeading: false },
    { order: 4, text: "50 ml water", amount: 50, isHeading: false },
  ],
  steps: [
    { order: 0, text: "# Cooking", isHeading: true },
    { order: 1, text: "Add the spices.", isHeading: false },
    { order: 3, text: "Add half the water.", isHeading: false },
  ],
};

function respondWith(output: unknown) {
  mocked.generateStructured.mockResolvedValue(output);
}

beforeEach(() => {
  vi.clearAllMocks();
  // No Decision Model for validation unless a test says otherwise: every
  // claim is kept unjudged.
  vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);
  vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
});

describe("inferStepIngredients", () => {
  it("is inert rather than broken when AI is globally disabled", async () => {
    mocked.generateStructured.mockRejectedValue(new AIDisabledError());

    await expect(inferStepIngredients(RECIPE)).rejects.toBeInstanceOf(AIDisabledError);
  });

  it("refuses a recipe with nothing linkable", async () => {
    await expect(
      inferStepIngredients({
        title: "Bare",
        ingredients: [{ order: 0, text: "# Only a heading", amount: null, isHeading: true }],
        steps: RECIPE.steps,
      })
    ).rejects.toThrow("No linkable ingredients or steps");
    expect(mocked.generateStructured).not.toHaveBeenCalled();
  });

  it("numbers only the linkable rows in the prompt, withholding headings", async () => {
    respondWith({ links: [] });

    await inferStepIngredients(RECIPE);

    expect(mocked.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "ingredient-linking",
        fill: expect.objectContaining({
          ingredients: "1. 5 g salt\n2. 3 g pepper\n3. 50 ml water",
          steps: "1. Add the spices.\n2. Add half the water.",
        }),
      })
    );
  });

  it("maps the claim's prompt numbers back onto row orders", async () => {
    respondWith({
      links: [
        {
          step: 1,
          ingredients: [
            { line: 1, share: 1, amount: null },
            { line: 2, share: 1, amount: null },
          ],
        },
        { step: 2, ingredients: [{ line: 3, share: 0.5, amount: null }] },
      ],
    });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([
      {
        stepOrder: 1,
        refs: [
          { ingredientOrder: 1, share: 1, order: 0 },
          { ingredientOrder: 2, share: 1, order: 1 },
        ],
      },
      // Row orders are not contiguous: the water line is order 4, step order 3.
      { stepOrder: 3, refs: [{ ingredientOrder: 4, share: 0.5, order: 0 }] },
    ]);
  });

  it("drops invented step and line numbers rather than writing them wrong", async () => {
    respondWith({
      links: [
        { step: 9, ingredients: [{ line: 1, share: 1, amount: null }] },
        { step: 1, ingredients: [{ line: 42, share: 1, amount: null }] },
      ],
    });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([]);
  });

  it("converts a stated amount into the line's share", async () => {
    // "Add 25 ml of the water" against the 50 ml line: the model states the
    // amount its step read; the division happens here, not in the model.
    respondWith({
      links: [{ step: 2, ingredients: [{ line: 3, share: null, amount: 25 }] }],
    });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([
      { stepOrder: 3, refs: [{ ingredientOrder: 4, share: 0.5, order: 0 }] },
    ]);
  });

  it("clamps a stated amount to the whole line", async () => {
    respondWith({
      links: [{ step: 2, ingredients: [{ line: 3, share: null, amount: 80 }] }],
    });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([
      { stepOrder: 3, refs: [{ ingredientOrder: 4, share: 1, order: 0 }] },
    ]);
  });

  it("prefers the stated amount over a share when both arrive", async () => {
    respondWith({
      links: [{ step: 2, ingredients: [{ line: 3, share: 0.2, amount: 25 }] }],
    });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([
      { stepOrder: 3, refs: [{ ingredientOrder: 4, share: 0.5, order: 0 }] },
    ]);
  });

  it("falls back to the whole line when an amount is stated for an amountless line", async () => {
    const recipe = {
      title: "Seasoned",
      ingredients: [{ order: 0, text: "salt to taste", amount: null, isHeading: false }],
      steps: [{ order: 0, text: "Season with 2 pinches of salt.", isHeading: false }],
    };

    respondWith({
      links: [{ step: 1, ingredients: [{ line: 1, share: null, amount: 2 }] }],
    });

    const claim = await inferStepIngredients(recipe);

    expect(claim.links).toEqual([
      { stepOrder: 0, refs: [{ ingredientOrder: 0, share: 1, order: 0 }] },
    ]);
  });

  it("uses the whole line when the claim states neither share nor amount", async () => {
    respondWith({
      links: [{ step: 1, ingredients: [{ line: 1, share: null, amount: null }] }],
    });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([
      { stepOrder: 1, refs: [{ ingredientOrder: 1, share: 1, order: 0 }] },
    ]);
  });

  it("returns an empty claim as a valid answer, not a failure", async () => {
    respondWith({ links: [] });

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toEqual([]);
  });

  it("lets a retryable provider failure out for the queue to retry", async () => {
    mocked.generateStructured.mockRejectedValue(
      new AIProviderError("provider timed out", { retryable: true })
    );

    const error = await inferStepIngredients(RECIPE).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).retryable).toBe(true);
  });
});

describe("Enrichment Validation", () => {
  /** The validation Decision: one probability per claim id. */
  function verdicts(probabilities: Record<string, number>) {
    return {
      model: "jev",
      answers: Object.fromEntries(
        Object.entries(probabilities).map(([id, probability]) => [
          id,
          { type: "boolean", probability },
        ])
      ),
    };
  }

  const PROPOSAL = {
    links: [
      {
        step: 1,
        ingredients: [
          { line: 1, share: 1, amount: null },
          { line: 2, share: 1, amount: null },
        ],
      },
      { step: 2, ingredients: [{ line: 3, share: 0.5, amount: null }] },
    ],
  };

  beforeEach(() => {
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
    mocked.decide.mockResolvedValue(verdicts({ "1:1": 0.9, "1:2": 0.9, "2:3": 0.9 }));
  });

  it("checks every proposed link as a question in prompt numbers, on the numbered recipe", async () => {
    respondWith(PROPOSAL);

    await inferStepIngredients(RECIPE);

    expect(mocked.decide).toHaveBeenCalledTimes(1);
    expect(mocked.decide).toHaveBeenCalledWith({
      feature: "ingredient-linking:validation",
      state: {
        title: "Spiced Stew",
        ingredients: ["1. 5 g salt", "2. 3 g pepper", "3. 50 ml water"],
        steps: ["1. Add the spices.", "2. Add half the water."],
      },
      questions: {
        "1:1": {
          type: "boolean",
          instructions: expect.stringMatching(/step 1 .*Add the spices.*line 1 .*5 g salt/),
        },
        "1:2": { type: "boolean", instructions: expect.stringMatching(/line 2 .*3 g pepper/) },
        "2:3": {
          type: "boolean",
          instructions: expect.stringMatching(/step 2 .*half the water.*line 3 .*50 ml water/),
        },
      },
    });
  });

  it("does not write a disputed link, and leaves a step bare when every link of it was disputed", async () => {
    respondWith(PROPOSAL);
    mocked.decide.mockResolvedValue(verdicts({ "1:1": 0.1, "1:2": 0.9, "2:3": 0.05 }));

    const claim = await inferStepIngredients(RECIPE);

    // The surviving ref is renumbered from zero: the write needs a contiguous order.
    expect(claim.links).toEqual([
      { stepOrder: 1, refs: [{ ingredientOrder: 2, share: 1, order: 0 }] },
    ]);
  });

  it("keeps a disputed link when the Validate enrichments use is off: the verdict is only logged", async () => {
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    respondWith(PROPOSAL);
    mocked.decide.mockResolvedValue(verdicts({ "1:1": 0.1, "1:2": 0.9, "2:3": 0.05 }));

    const claim = await inferStepIngredients(RECIPE);

    expect(claim.links).toHaveLength(2);
    expect(claim.links[0]?.refs).toHaveLength(2);
  });

  it("validates nothing invented: a link to a number the prompt never printed is dropped first", async () => {
    respondWith({ links: [{ step: 1, ingredients: [{ line: 42, share: 1, amount: null }] }] });

    await inferStepIngredients(RECIPE);

    // No claim survived the numbering, so there was nothing to ask.
    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it("never validates stored data: a link a person attached is neither a question nor a casualty", async () => {
    // The worker hands over only steps that have no links; a stored link
    // riding along on the input is not this run's claim and cannot be judged.
    const stored = {
      ...RECIPE,
      steps: RECIPE.steps.map((step) => ({ ...step, refs: [{ ingredientOrder: 4 }] })),
    };

    respondWith({ links: [{ step: 1, ingredients: [{ line: 1, share: 1, amount: null }] }] });
    mocked.decide.mockResolvedValue(verdicts({ "1:1": 0.9, "1:3": 0.01, "2:3": 0.01 }));

    const claim = await inferStepIngredients(stored);

    expect(Object.keys(mocked.decide.mock.calls[0]?.[0].questions)).toEqual(["1:1"]);
    expect(claim.links).toEqual([
      { stepOrder: 1, refs: [{ ingredientOrder: 1, share: 1, order: 0 }] },
    ]);
  });
});
