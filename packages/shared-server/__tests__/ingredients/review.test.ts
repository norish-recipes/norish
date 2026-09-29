// @vitest-environment node
/**
 * Asking AI about a Flagged Ingredient after the fact, against a real
 * database: the flagged food is never its own candidate, a sure answer is
 * acted on as the page's own edits would be, and an unsure one leaves the
 * flag with its reason brought up to date. The Decision is mocked at
 * `decide` and the language model at `generateStructured`, as in rung 3's tests.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { DecisionQuestions } from "@norish/shared-server/ai/runtime/runtime";
import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { findIngredientAncestors } from "@norish/db/repositories/ingredient-relocation";
import { decide, generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { markDistinct } from "@norish/shared-server/ingredients/catalogue";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { reviewFlaggedWithAI } from "@norish/shared-server/ingredients/review";

import { createTestUser } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
}));
vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAIEnabled: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

/** A Decision that picks the option reading `pick` with probability `p`, and records what it was offered. */
function decides(pick: string, p: number, offered: string[] = []) {
  vi.mocked(decide).mockImplementationOnce((async ({
    questions,
  }: {
    questions: DecisionQuestions;
  }) => {
    const [id, question] = Object.entries(questions)[0]!;

    if (question.type !== "choice") throw new Error("expected a choice");

    const labels = Object.keys(question.criteria);

    offered.push(...labels.map((label) => question.criteria[label]!));

    const choice = labels.find((label) => question.criteria[label] === pick);

    if (!choice) throw new Error(`no option reads "${pick}": ${JSON.stringify(question.criteria)}`);

    const rest = (1 - p) / Math.max(labels.length - 1, 1);

    return {
      model: "jev-test",
      answers: {
        [id]: {
          type: "choice",
          choice,
          probabilities: Object.fromEntries(
            labels.map((label) => [label, label === choice ? p : rest])
          ),
        },
      },
    };
  }) as never);
}

describe("asking AI about a flagged Ingredient", () => {
  const testBase = new RepositoryTestBase("test_ingredient_review");

  let actor: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
    vi.mocked(decide).mockReset();
    vi.mocked(generateStructured).mockReset();
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A food minted while nothing could be asked: flagged, as the upgrade leaves them. */
  async function flagged(text: string) {
    vi.mocked(isAIEnabled).mockResolvedValueOnce(false);
    const [resolved] = await resolveIngredients([text], { userId: actor.userId });

    return resolved!;
  }

  it("merges a food AI is sure is a known one, never offering the food itself", async () => {
    const onion = await flagged("onion");
    const onions = await flagged("onions");
    const offered: string[] = [];

    decides("Is onion", 0.95, offered);

    await expect(reviewFlaggedWithAI(actor, onions.ingredientId)).resolves.toMatchObject({
      outcome: "merged",
      into: "onion",
    });
    expect(offered).not.toContain("Is onions");
    await expect(ingredientFor(onions.aliasId)).resolves.toMatchObject({
      id: onion.ingredientId,
    });
  });

  it("files a food AI is sure is a kind of a known one under it, and clears the flag", async () => {
    const onion = await flagged("onion");
    const red = await flagged("red onion");

    decides("Is a kind of onion", 0.95);

    await expect(reviewFlaggedWithAI(actor, red.ingredientId)).resolves.toMatchObject({
      outcome: "parent",
      of: "onion",
    });
    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({ flagged: false });
    expect((await findIngredientAncestors([red.ingredientId])).get(red.ingredientId)).toEqual([
      onion.ingredientId,
    ]);
  });

  it("marks a food AI is sure is its own distinct", async () => {
    await flagged("onion");
    const spring = await flagged("spring onion");

    decides("Is none of these, but a food of its own", 0.95);

    await expect(reviewFlaggedWithAI(actor, spring.ingredientId)).resolves.toMatchObject({
      outcome: "distinct",
    });
    await expect(ingredientFor(spring.aliasId)).resolves.toMatchObject({
      flagged: false,
      flagReason: null,
    });
  });

  it("leaves the flag, with the reason brought up to date, where AI is not sure", async () => {
    await flagged("onion");
    const uitjes = await flagged("onion rings");

    decides("Is onion", 0.4);
    vi.mocked(generateStructured).mockResolvedValueOnce({ verdict: "same", food: 1, sure: false });

    await expect(reviewFlaggedWithAI(actor, uitjes.ingredientId)).resolves.toMatchObject({
      outcome: "unsure",
      reason: "ai-unsure",
    });
    await expect(ingredientFor(uitjes.aliasId)).resolves.toMatchObject({
      flagged: true,
      flagReason: "ai-unsure",
    });
  });

  it("asks AI about a name no known food shares a word with, and follows the food it names", async () => {
    // "ui" shares no letters with "onion": rung 3 asked nothing and minted it flagged.
    const onion = await flagged("onion");
    const ui = await flagged("ui");

    // With no candidates, the language model is asked what plain food this is…
    vi.mocked(generateStructured).mockResolvedValueOnce({
      verdict: "new",
      food: null,
      sure: true,
      englishName: "onion",
    });
    // …and the foods that name finds are put to the Decision.
    const offered: string[] = [];

    decides("Is onion", 0.95, offered);

    await expect(reviewFlaggedWithAI(actor, ui.ingredientId)).resolves.toMatchObject({
      outcome: "merged",
      into: "onion",
      considered: ["onion"],
      englishName: "onion",
    });
    expect(offered).toContain("Is onion");
    await expect(ingredientFor(ui.aliasId)).resolves.toMatchObject({ id: onion.ingredientId });
  });

  it("takes a second look when the first candidates were the wrong foods", async () => {
    // "kipfilet" finds nothing under "kipf", but the model knows it is chicken breast.
    const chicken = await flagged("chicken");
    const kipfilet = await flagged("kipfilet");

    vi.mocked(generateStructured).mockResolvedValueOnce({
      verdict: "new",
      food: null,
      sure: true,
      englishName: "chicken breast",
    });
    decides("Is a kind of chicken", 0.9);

    await expect(reviewFlaggedWithAI(actor, kipfilet.ingredientId)).resolves.toMatchObject({
      outcome: "parent",
      of: "chicken",
    });
    expect(
      (await findIngredientAncestors([kipfilet.ingredientId])).get(kipfilet.ingredientId)
    ).toEqual([chicken.ingredientId]);
  });

  it("takes the second look after an unsure 'kind of' too, and keeps the first reason when both are unsure", async () => {
    const onion = await flagged("onion");
    const rings = await flagged("uienringen");

    // Unsure kind-of among the first candidates (none here), naming the food.
    vi.mocked(generateStructured).mockResolvedValueOnce({
      verdict: "kind-of",
      food: null,
      sure: false,
      englishName: "onion",
    });
    // The second look, over onion, is unsure as well.
    decides("Is a kind of onion", 0.5);
    vi.mocked(generateStructured).mockResolvedValueOnce({
      verdict: "kind-of",
      food: 1,
      sure: false,
      englishName: "onion rings",
    });

    await expect(reviewFlaggedWithAI(actor, rings.ingredientId)).resolves.toMatchObject({
      outcome: "unsure",
      reason: "ai-unsure",
    });
    expect(vi.mocked(decide)).toHaveBeenCalledTimes(1);
    await expect(ingredientFor(rings.aliasId)).resolves.toMatchObject({
      flagged: true,
      id: expect.not.stringMatching(onion.ingredientId),
    });
  });

  it("leaves a name AI cannot place flagged, saying AI was not sure", async () => {
    const multitool = await flagged("Multitool");

    vi.mocked(generateStructured).mockResolvedValueOnce({
      verdict: "new",
      food: null,
      sure: false,
      englishName: null,
    });

    await expect(reviewFlaggedWithAI(actor, multitool.ingredientId)).resolves.toMatchObject({
      outcome: "unsure",
      reason: "ai-unsure",
    });
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
  });

  it("marks a name AI is sure is a food of its own distinct, even with nothing to compare it with", async () => {
    const knaks = await flagged("Unox Knaks");

    vi.mocked(generateStructured).mockResolvedValueOnce({
      verdict: "new",
      food: null,
      sure: true,
      englishName: "frankfurter",
    });

    await expect(reviewFlaggedWithAI(actor, knaks.ingredientId)).resolves.toMatchObject({
      outcome: "distinct",
    });
    await expect(ingredientFor(knaks.aliasId)).resolves.toMatchObject({ flagged: false });
  });

  it("has nothing to ask about a food that is not flagged", async () => {
    const onion = await flagged("onion");

    await markDistinct(actor, onion.ingredientId);

    await expect(reviewFlaggedWithAI(actor, onion.ingredientId)).resolves.toMatchObject({
      outcome: "not-flagged",
    });
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
  });

  it("follows the edit policy", async () => {
    const onion = await flagged("onion");
    const stranger = await createTestUser();

    await expect(
      reviewFlaggedWithAI(
        { userId: stranger.id, householdUserIds: null, isServerAdmin: false },
        onion.ingredientId
      )
    ).rejects.toMatchObject({ refusal: "forbidden" });
  });
});
