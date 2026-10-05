// @vitest-environment node
/**
 * Asking AI about a Flagged Ingredient after the fact, against a real
 * database: the flagged food is never its own candidate, a sure answer is
 * recorded as a suggestion and nothing else — the food is left as it was
 * until a person confirms it — and an unsure one leaves the flag with its
 * reason brought up to date. The Decision is mocked at
 * `decide` and the language model at `generateStructured`, as in rung 3's tests.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { DecisionQuestions } from "@norish/shared-server/ai/runtime/runtime";
import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { findIngredientAncestors } from "@norish/db/repositories/ingredient-relocation";
import {
  listIngredientSuggestions,
  upsertIngredientSuggestion,
} from "@norish/db/repositories/ingredient-suggestions";
import {
  decide,
  estimateDecisionInputTokens,
  estimateStructuredInputTokens,
  generateStructured,
} from "@norish/shared-server/ai/runtime/runtime";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { markDistinct, setParent } from "@norish/shared-server/ingredients/catalogue";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import {
  estimateReviewTokens,
  findParentWithAI,
  listReviewableIngredients,
  reviewFlaggedWithAI,
} from "@norish/shared-server/ingredients/review";
import {
  confirmSuggestion,
  dismissSuggestion,
} from "@norish/shared-server/ingredients/suggestions";

import { createTestUser } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
  estimateStructuredInputTokens: vi.fn(),
  estimateDecisionInputTokens: vi.fn(),
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

/** What the language model reads a name as, before any comparing. */
function reads(reading: { englishName: string | null; generalFood: string | null; sure: boolean }) {
  vi.mocked(generateStructured).mockResolvedValueOnce(reading);
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

  /** What AI proposes for a food, as the page reads it: its kind and the food it names. */
  async function suggestionFor(ingredientId: string) {
    const found = (await listIngredientSuggestions()).find(
      (it) => it.ingredientId === ingredientId
    );

    return found ? { id: found.id, kind: found.kind, target: found.target?.name ?? null } : null;
  }

  /** A food minted while nothing could be asked: flagged, as the upgrade leaves them. */
  async function flagged(text: string) {
    vi.mocked(isAIEnabled).mockResolvedValueOnce(false);
    const [resolved] = await resolveIngredients([text], { userId: actor.userId });

    return resolved!;
  }

  it("suggests merging a food AI is sure is a known one, never offering the food itself", async () => {
    const onion = await flagged("onion");
    const bulbs = await flagged("onion bulbs");
    const offered: string[] = [];

    decides("Is onion", 0.95, offered);

    await expect(reviewFlaggedWithAI(actor, bulbs.ingredientId)).resolves.toMatchObject({
      outcome: "merge",
      into: "onion",
    });
    expect(offered).not.toContain("Is onion bulbs");
    // Nothing merged yet: a person confirms first.
    await expect(ingredientFor(bulbs.aliasId)).resolves.toMatchObject({
      id: bulbs.ingredientId,
      flagged: true,
    });
    const suggestion = await suggestionFor(bulbs.ingredientId);

    expect(suggestion).toMatchObject({ kind: "merge", target: "onion" });
    await confirmSuggestion(actor, suggestion!.id);
    await expect(ingredientFor(bulbs.aliasId)).resolves.toMatchObject({
      id: onion.ingredientId,
    });
    expect(await listIngredientSuggestions()).toEqual([]);
  });

  it("suggests filing a food under the one AI says it is a kind of, and confirming files it", async () => {
    const onion = await flagged("onion");
    const red = await flagged("red onion");

    decides("Is a kind of onion", 0.95);

    await expect(reviewFlaggedWithAI(actor, red.ingredientId)).resolves.toMatchObject({
      outcome: "parent",
      of: "onion",
    });
    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({ flagged: true });
    expect((await findIngredientAncestors([red.ingredientId])).get(red.ingredientId)).toEqual([]);

    await confirmSuggestion(actor, (await suggestionFor(red.ingredientId))!.id);
    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({ flagged: false });
    expect(await suggestionFor(red.ingredientId)).toBeNull();
    expect((await findIngredientAncestors([red.ingredientId])).get(red.ingredientId)).toEqual([
      onion.ingredientId,
    ]);
  });

  it("finds a food's parent whether or not it is flagged, and suggests a duplicate's merge", async () => {
    const onion = await flagged("onion");
    const red = await flagged("red onion");
    const bulbs = await flagged("onion bulbs");

    // Unflagged all three: a parent is asked for regardless.
    for (const food of [onion, red, bulbs]) await markDistinct(actor, food.ingredientId);
    decides("Is a kind of onion", 0.95);
    await expect(findParentWithAI(actor, red.ingredientId)).resolves.toMatchObject({
      outcome: "parent",
      of: "onion",
    });
    expect(await suggestionFor(red.ingredientId)).toMatchObject({
      kind: "parent",
      target: "onion",
    });

    decides("Is onion", 0.95);
    await expect(findParentWithAI(actor, bulbs.ingredientId)).resolves.toMatchObject({
      outcome: "merge",
      into: "onion",
    });
    // Still a food of its own: a person merges, not AI.
    await expect(ingredientFor(bulbs.aliasId)).resolves.toMatchObject({
      id: bulbs.ingredientId,
    });
    expect(await suggestionFor(bulbs.ingredientId)).toMatchObject({ kind: "merge" });

    // A food nobody doubted that AI calls its own: nothing to suggest.
    decides("Is none of these, but a food of its own", 0.95);
    await expect(findParentWithAI(actor, onion.ingredientId)).resolves.toMatchObject({
      outcome: "distinct",
    });
    expect(await suggestionFor(onion.ingredientId)).toBeNull();
  });

  it("dismissing leaves the food as it was, and asking again replaces the suggestion", async () => {
    await flagged("onion");
    const red = await flagged("red onion");

    decides("Is a kind of onion", 0.95);
    await reviewFlaggedWithAI(actor, red.ingredientId);
    decides("Is onion", 0.95);
    await reviewFlaggedWithAI(actor, red.ingredientId);
    const suggestion = await suggestionFor(red.ingredientId);

    expect(suggestion).toMatchObject({ kind: "merge", target: "onion" });
    expect(await listIngredientSuggestions()).toHaveLength(1);

    await dismissSuggestion(actor, suggestion!.id);
    expect(await suggestionFor(red.ingredientId)).toBeNull();
    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({
      id: red.ingredientId,
      flagged: true,
    });
  });

  it("lets one general food gather many suggested kinds", async () => {
    await flagged("meat");
    const mince = await flagged("minced meat");
    const steak = await flagged("meat steak");

    decides("Is a kind of meat", 0.9);
    await reviewFlaggedWithAI(actor, mince.ingredientId);
    decides("Is a kind of meat", 0.9);
    await reviewFlaggedWithAI(actor, steak.ingredientId);

    expect((await listIngredientSuggestions()).map((it) => [it.kind, it.target?.name])).toEqual([
      ["parent", "meat"],
      ["parent", "meat"],
    ]);
  });

  it("suggests a food AI is sure is its own be marked distinct", async () => {
    await flagged("onion");
    const spring = await flagged("spring onion");

    decides("Is none of these, but a food of its own", 0.95);

    await expect(reviewFlaggedWithAI(actor, spring.ingredientId)).resolves.toMatchObject({
      outcome: "distinct",
    });
    await expect(ingredientFor(spring.aliasId)).resolves.toMatchObject({ flagged: true });

    await confirmSuggestion(actor, (await suggestionFor(spring.ingredientId))!.id);
    await expect(ingredientFor(spring.aliasId)).resolves.toMatchObject({
      flagged: false,
      flagReason: null,
    });
  });

  it("leaves the flag, with the reason brought up to date, where AI is not sure", async () => {
    await flagged("onion");
    const uitjes = await flagged("onion rings");

    reads({ englishName: "onion rings", generalFood: "onion", sure: false });
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
    expect(await suggestionFor(uitjes.ingredientId)).toBeNull();
  });

  it("asks AI about a name no known food shares a word with, and follows the food it names", async () => {
    // "ui" shares no letters with "onion": rung 3 asked nothing and minted it flagged.
    const onion = await flagged("onion");
    const bulbs = await flagged("onion bulbs");

    // The language model reads the name first…
    reads({ englishName: "onion", generalFood: null, sure: true });
    // …and the foods that reading finds are put to the Decision.
    const offered: string[] = [];

    decides("Is onion", 0.95, offered);

    await expect(reviewFlaggedWithAI(actor, bulbs.ingredientId)).resolves.toMatchObject({
      outcome: "merge",
      into: "onion",
      considered: ["onion"],
      englishName: "onion",
    });
    expect(offered).toContain("Is onion");
    const suggestion = (await listIngredientSuggestions())[0];

    expect(suggestion).toMatchObject({
      ingredientId: bulbs.ingredientId,
      target: { id: onion.ingredientId },
      englishName: "onion",
      considered: ["onion"],
    });
  });

  it("suggests the general food a name's reading names as its parent", async () => {
    // "kipfilet" finds nothing under "kipf", but the model reads it as a kind of chicken.
    await flagged("chicken");
    const kipfilet = await flagged("kipfilet");

    reads({ englishName: "chicken breast", generalFood: "chicken", sure: true });
    decides("Is a kind of chicken", 0.9);

    await expect(reviewFlaggedWithAI(actor, kipfilet.ingredientId)).resolves.toMatchObject({
      outcome: "parent",
      of: "chicken",
    });
    expect(await suggestionFor(kipfilet.ingredientId)).toMatchObject({
      kind: "parent",
      target: "chicken",
    });
  });

  it("offers a candidate's parent, so a kind-of answer can land on it", async () => {
    const sausage = await flagged("sausage");
    const frankfurter = await flagged("frankfurter");

    await setParent(actor, frankfurter.ingredientId, sausage.ingredientId);
    const knaks = await flagged("knakworst");
    const offered: string[] = [];

    reads({ englishName: "frankfurter", generalFood: null, sure: true });
    decides("Is a kind of sausage", 0.9, offered);

    await expect(reviewFlaggedWithAI(actor, knaks.ingredientId)).resolves.toMatchObject({
      outcome: "parent",
      of: "sausage",
      considered: expect.arrayContaining(["frankfurter", "sausage"]),
    });
    expect(offered).toContain("Is a kind of sausage");
  });

  it("leaves the reading's doubt on the flag when nothing compares", async () => {
    const thing = await flagged("Multitool deluxe");

    reads({ englishName: "multitool", generalFood: "tool", sure: false });

    await expect(reviewFlaggedWithAI(actor, thing.ingredientId)).resolves.toMatchObject({
      outcome: "unsure",
      reason: "ai-unsure",
      englishName: "multitool",
    });
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
  });

  it("leaves a name AI cannot place flagged, saying AI was not sure", async () => {
    const multitool = await flagged("Multitool");

    reads({ englishName: null, generalFood: null, sure: false });

    await expect(reviewFlaggedWithAI(actor, multitool.ingredientId)).resolves.toMatchObject({
      outcome: "unsure",
      reason: "ai-unsure",
    });
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
  });

  it("suggests a name AI is sure is a food of its own be marked distinct, even with nothing to compare it with", async () => {
    const knaks = await flagged("Unox Knaks");

    reads({ englishName: "frankfurter", generalFood: "sausage", sure: true });

    await expect(reviewFlaggedWithAI(actor, knaks.ingredientId)).resolves.toMatchObject({
      outcome: "distinct",
    });
    expect(await suggestionFor(knaks.ingredientId)).toMatchObject({ kind: "distinct" });
    await expect(ingredientFor(knaks.aliasId)).resolves.toMatchObject({ flagged: true });
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

describe("what a round of Ask AI picks from", () => {
  const testBase = new RepositoryTestBase("test_ingredient_review_scope");

  let actor: CatalogueActor;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    actor = { userId: user.id, householdUserIds: null, isServerAdmin: false };
    vi.mocked(isAIEnabled).mockResolvedValue(false);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
    vi.mocked(estimateStructuredInputTokens)
      .mockReset()
      .mockResolvedValue({ provider: "openai", model: "gpt-5.6-luna", tokens: 700 });
    vi.mocked(estimateDecisionInputTokens)
      .mockReset()
      .mockResolvedValue({ provider: "typesafe", model: "jev-latest", tokens: 500 });
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A food minted while AI was off, flagged, as `owner`'s. */
  async function flaggedAs(text: string, owner: string | null = actor.userId) {
    const [resolved] = await resolveIngredients([text], { userId: owner });

    return resolved!.ingredientId;
  }

  it("lists the flagged foods the asker may edit, by name, saying which a suggestion waits on", async () => {
    const bulbs = await flaggedAs("onion bulbs");
    const uien = await flaggedAs("uien");
    const knaks = await flaggedAs("Unox Knaks");
    const settled = await flaggedAs("shallot");
    const nobodys = await flaggedAs("anna avondeten", null);
    const strangers = await flaggedAs("bosuitjes", (await createTestUser()).id);

    await markDistinct(actor, settled);
    await upsertIngredientSuggestion({
      ingredientId: uien,
      kind: "merge",
      targetId: bulbs,
      englishName: "onions",
      considered: ["onion bulbs"],
    });

    const listed = await listReviewableIngredients(actor);

    expect(listed.map(({ id, name, suggested }) => ({ id, name, suggested }))).toEqual([
      { id: bulbs, name: "onion bulbs", suggested: false },
      { id: uien, name: "uien", suggested: true },
      { id: knaks, name: "Unox Knaks", suggested: false },
    ]);
    // Only those no suggestion waits on, for a round over the gap.
    expect((await listReviewableIngredients(actor, "unsuggested")).map((food) => food.id)).toEqual([
      bulbs,
      knaks,
    ]);
    // A server admin may edit every food, the ones nobody owns included.
    expect(
      (await listReviewableIngredients({ ...actor, isServerAdmin: true })).map((food) => food.id)
    ).toEqual(expect.arrayContaining([nobodys, strangers]));
  });

  it("estimates a food's question from what would be sent, each request in full, with nothing asked", async () => {
    await flaggedAs("onion");

    // "onion bulbs" shares a word with onion: read, compare, and a Decision.
    // "Unox Knaks" shares none: read and compare, with no Decision to ask.
    const perModel = await estimateReviewTokens(["onion bulbs", "Unox Knaks"]);

    // Each request with its 50-token answer, averaged over the two names.
    expect(perModel).toEqual([
      { provider: "openai", model: "gpt-5.6-luna", perFood: 750 + 750 },
      { provider: "typesafe", model: "jev-latest", perFood: (500 + 50) / 2 },
    ]);
    const comparing = vi
      .mocked(estimateStructuredInputTokens)
      .mock.calls.map(([options]) => options.sections?.join("\n") ?? "")
      .filter((text) => text.includes("Foods in the catalogue"));

    expect(comparing).toEqual(
      expect.arrayContaining([
        expect.stringContaining("1. onion"),
        expect.stringContaining("none share a word"),
      ])
    );
    expect(vi.mocked(generateStructured)).not.toHaveBeenCalled();
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
  });

  it("leaves out the Decision where none is in use, and reads a few names spread over the round", async () => {
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    const names = Array.from({ length: 20 }, (_, index) => `food ${index}`);

    await expect(estimateReviewTokens(names)).resolves.toEqual([
      { provider: "openai", model: "gpt-5.6-luna", perFood: 700 + 50 + 700 + 50 },
    ]);

    // Two requests a name, for five names spread over the twenty.
    const read = vi
      .mocked(estimateStructuredInputTokens)
      .mock.calls.map(([options]) => options.sections?.[0]);

    expect(new Set(read)).toEqual(
      new Set([
        "New name: food 0",
        "New name: food 4",
        "New name: food 8",
        "New name: food 12",
        "New name: food 16",
      ])
    );
    expect(vi.mocked(estimateDecisionInputTokens)).not.toHaveBeenCalled();
  });

  it("estimates nothing for a round with no foods", async () => {
    await expect(estimateReviewTokens([])).resolves.toEqual([]);
  });
});
