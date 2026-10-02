// @vitest-environment node
/**
 * Rung 3 of the ingredient resolver against a real database: a text no alias
 * matches is asked about before anything is minted. The Decision is mocked at
 * `decide`, the one AI seam, and the language-model fallback at the runtime's
 * `generateStructured`; the configuration says whether either may be asked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import type { DecisionQuestions } from "@norish/shared-server/ai/runtime/runtime";
import { withTransaction } from "@norish/db/drizzle";
import {
  findIngredientAncestors,
  mergeCatalogueIngredients,
} from "@norish/db/repositories/ingredient-relocation";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import { listIngredientSuggestions } from "@norish/db/repositories/ingredient-suggestions";
import { ingredientAliases, ingredients } from "@norish/db/schema";
import {
  RESOLUTION_BUDGET_MS,
  RESOLUTION_THRESHOLD,
} from "@norish/shared-server/ai/resolution/ingredient-resolution";
import { decide, generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
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

/**
 * A Decision that picks the option whose description is `pick` with
 * probability `p`, the rest of the mass on the other options. `meanwhile`
 * runs while the Decision is thinking.
 */
function decides(pick: string, p: number, meanwhile?: () => Promise<unknown>) {
  vi.mocked(decide).mockImplementationOnce((async ({
    questions,
  }: {
    questions: DecisionQuestions;
  }) => {
    await meanwhile?.();
    const [id, question] = Object.entries(questions)[0]!;

    if (question.type !== "choice") throw new Error("expected a choice");

    const labels = Object.keys(question.criteria);
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

/** What the language model answers about the numbered known foods. */
function answers(answer: {
  verdict: "same" | "kind-of" | "new";
  food: number | null;
  sure: boolean;
}) {
  vi.mocked(generateStructured).mockResolvedValueOnce(answer);
}

/** The language model's answer naming a listed food by name, whatever its number. */
function answersAbout(name: string, verdict: "same" | "kind-of", sure: boolean) {
  vi.mocked(generateStructured).mockImplementationOnce((async ({
    sections,
  }: {
    sections: string[];
  }) => {
    const line = sections
      .join("\n")
      .split("\n")
      .find((row) => /^\d+\. /.test(row) && row.slice(row.indexOf(" ") + 1).startsWith(name));

    if (!line) throw new Error(`no listed food reads "${name}": ${sections.join(" | ")}`);

    return { verdict, food: Number(line.split(".")[0]), sure, englishName: null };
  }) as never);
}

function entry(offId: string, ...names: string[]): SeedEntry {
  return {
    offId,
    name: names[0]!,
    nameFold: ingredientAliasFold(names[0]!),
    parentOffId: null,
    nutrition: null,
    aliases: names.map((text) => ({ text, fold: ingredientAliasFold(text), locale: null })),
  };
}

describe("ingredient resolver, rung 3", () => {
  const testBase = new RepositoryTestBase("test_ingredient_resolver_ai");

  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    vi.mocked(decide).mockReset();
    vi.mocked(generateStructured).mockReset();
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function resolveOne(text: string) {
    const [resolved] = await resolveIngredients([text], { userId });

    return resolved!;
  }

  /** A food Norish already knows, minted while nothing could be asked. */
  async function known(text: string) {
    vi.mocked(isAIEnabled).mockResolvedValueOnce(false);

    return resolveOne(text);
  }

  it("mints a flagged food where the food a sure answer named was merged away meanwhile", async () => {
    const onion = await known("onion");
    const shallot = await known("shallot");

    decides("Is onion", 0.95, () =>
      withTransaction((tx) =>
        mergeCatalogueIngredients(tx, onion.ingredientId, shallot.ingredientId)
      )
    );

    const onions = await resolveOne("onions");

    expect(onions.ingredientId).not.toBe(onion.ingredientId);
    await expect(ingredientFor(onions.aliasId)).resolves.toMatchObject({
      name: "onions",
      flagged: true,
    });
  });

  it("files a text a sure Decision names as a known food under that food", async () => {
    const onion = await known("onion");

    decides("Is onion", 0.95);
    const onions = await resolveOne("onions");

    expect(onions.ingredientId).toBe(onion.ingredientId);
    expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("ingredientResolution");

    // Now a spelling of onion: the next one matches exactly, and nothing is asked.
    await expect(resolveOne("Onions")).resolves.toMatchObject({
      ingredientId: onion.ingredientId,
    });
    expect(vi.mocked(decide)).toHaveBeenCalledTimes(1);
  });

  it("acts on a Decision exactly at the threshold, and asks the language model just below it", async () => {
    const tomato = await known("tomato");

    decides("Is tomato", RESOLUTION_THRESHOLD);
    await expect(resolveOne("tomatoes")).resolves.toMatchObject({
      ingredientId: tomato.ingredientId,
    });
    expect(vi.mocked(generateStructured)).not.toHaveBeenCalled();

    decides("Is tomato", RESOLUTION_THRESHOLD - 0.01);
    answers({ verdict: "new", food: null, sure: false });
    const paste = await resolveOne("tomato paste");

    expect(vi.mocked(generateStructured)).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "ingredient-resolution" })
    );
    expect(paste.ingredientId).not.toBe(tomato.ingredientId);
  });

  it("mints a new food, unflagged, where the Decision is sure it is one", async () => {
    await known("onion");

    decides("Is none of these, but a food of its own", 0.9);
    const powder = await resolveOne("onion powder");

    await expect(ingredientFor(powder.aliasId)).resolves.toMatchObject({
      name: "onion powder",
      flagged: false,
    });
  });

  it("places a sure kind-of answer under the food it is a kind of", async () => {
    const onion = await known("onion");

    decides("Is a kind of onion", 0.9);
    const red = await resolveOne("red onion");

    expect(red.ingredientId).not.toBe(onion.ingredientId);
    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({ flagged: false });
    await expect(findIngredientAncestors([red.ingredientId])).resolves.toEqual(
      new Map([[red.ingredientId, [onion.ingredientId]]])
    );
  });

  it("places an unsure kind-of answer under the food too, and flags it", async () => {
    const onion = await known("onion");

    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    answers({ verdict: "kind-of", food: 1, sure: false });
    const red = await resolveOne("red onion");

    await expect(ingredientFor(red.aliasId)).resolves.toMatchObject({ flagged: true });
    await expect(findIngredientAncestors([red.ingredientId])).resolves.toEqual(
      new Map([[red.ingredientId, [onion.ingredientId]]])
    );
  });

  it("mints a kind of a food merged away meanwhile with no parent", async () => {
    const onion = await known("onion");
    const shallot = await known("shallot");

    decides("Is a kind of onion", 0.9, () =>
      withTransaction((tx) =>
        mergeCatalogueIngredients(tx, onion.ingredientId, shallot.ingredientId)
      )
    );
    const red = await resolveOne("red onion");

    await expect(findIngredientAncestors([red.ingredientId])).resolves.toEqual(
      new Map([[red.ingredientId, []]])
    );
  });

  it("follows a sure language-model answer when the Decision is unsure", async () => {
    const milk = await known("milk");

    decides("Is milk", 0.4);
    answers({ verdict: "same", food: 1, sure: true });

    await expect(resolveOne("whole milk")).resolves.toMatchObject({
      ingredientId: milk.ingredientId,
    });
  });

  it("flags what it mints after an answer that was not sure", async () => {
    const milk = await known("milk");

    decides("Is milk", 0.4);
    answers({ verdict: "same", food: 1, sure: false });
    const oat = await resolveOne("oat milk");

    expect(oat.ingredientId).not.toBe(milk.ingredientId);
    await expect(ingredientFor(oat.aliasId)).resolves.toMatchObject({
      flagged: true,
      flagReason: "ai-unsure",
    });
  });

  it("asks the language model when the Decision fails", async () => {
    const leek = await known("leek");

    vi.mocked(decide).mockRejectedValueOnce(new Error("Decision Model unreachable"));
    answers({ verdict: "same", food: 1, sure: true });

    await expect(resolveOne("leeks")).resolves.toMatchObject({ ingredientId: leek.ingredientId });
  });

  it("asks the language model alone when the Decision Model is not in use", async () => {
    const leek = await known("leek");

    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    answers({ verdict: "same", food: 1, sure: true });

    await expect(resolveOne("leeks")).resolves.toMatchObject({ ingredientId: leek.ingredientId });
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
  });

  it("mints a flagged food, and never fails, when every AI step fails", async () => {
    await known("garlic");

    vi.mocked(decide).mockRejectedValueOnce(new Error("Decision Model unreachable"));
    vi.mocked(generateStructured).mockRejectedValueOnce(new Error("model unreachable"));
    const cloves = await resolveOne("garlic cloves");

    await expect(ingredientFor(cloves.aliasId)).resolves.toMatchObject({ flagged: true });
  });

  it("asks nothing without AI, and flags what it mints", async () => {
    await known("garlic");

    vi.mocked(isAIEnabled).mockResolvedValue(false);
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    const cloves = await resolveOne("garlic cloves");

    expect(vi.mocked(decide)).not.toHaveBeenCalled();
    expect(vi.mocked(generateStructured)).not.toHaveBeenCalled();
    await expect(ingredientFor(cloves.aliasId)).resolves.toMatchObject({
      flagged: true,
      flagReason: "ai-off",
    });
  });

  it("asks nothing for a text that shares no word with any known food, and flags it", async () => {
    await known("onion");

    // Could be a translation nothing here can see ("ui"): a person's to judge.
    const ui = await resolveOne("ui");

    expect(vi.mocked(decide)).not.toHaveBeenCalled();
    await expect(ingredientFor(ui.aliasId)).resolves.toMatchObject({
      flagged: true,
      flagReason: "unknown-food",
    });
  });

  it("mints a flagged food rather than wait past the budget on AI", async () => {
    await known("garlic");
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      vi.mocked(decide).mockReturnValueOnce(new Promise(() => undefined));
      const pending = resolveOne("garlic cloves");

      await vi.waitFor(() => expect(vi.mocked(decide)).toHaveBeenCalled());
      await vi.advanceTimersByTimeAsync(RESOLUTION_BUDGET_MS);
      const cloves = await pending;

      await expect(ingredientFor(cloves.aliasId)).resolves.toMatchObject({ flagged: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("finds the food a name is about even where a common word fills the catalogue", async () => {
    const onion = await known("onion");
    // More foods starting "red" than one search reads.
    const reds = await getTestDb()
      .insert(ingredients)
      .values(Array.from({ length: 450 }, (_, index) => ({ name: `red thing ${index}` })))
      .returning({ id: ingredients.id, name: ingredients.name });

    await getTestDb()
      .insert(ingredientAliases)
      .values(reds.map((row) => ({ text: row.name, fold: row.name, ingredientId: row.id })));

    decides("Is onion", 0.95);

    await expect(resolveOne("red onions")).resolves.toMatchObject({
      ingredientId: onion.ingredientId,
    });
  });

  describe("weighed against the words of the name", () => {
    let seeded: Map<string, string>;

    beforeEach(async () => {
      // "garlic cloves crushed" points at garlic by its words; "clov" also finds the spice.
      await applyIngredientSeed([entry("en:garlic", "garlic"), entry("en:clove", "clove")]);
      seeded = await listSeededIngredientIds();
    });

    async function parentOf(ingredientId: string) {
      return (await findIngredientAncestors([ingredientId])).get(ingredientId)?.[0] ?? null;
    }

    it("takes an unsure answer that agrees with the words as sure: filed, unflagged, no question", async () => {
      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
      answersAbout("garlic", "kind-of", false);
      const cloves = await resolveOne("garlic cloves crushed");

      await expect(ingredientFor(cloves.aliasId)).resolves.toMatchObject({
        name: "garlic cloves",
        flagged: false,
      });
      expect(await parentOf(cloves.ingredientId)).toBe(seeded.get("en:garlic"));
      expect(await listIngredientSuggestions()).toHaveLength(0);
    });

    it("lets the Decision settle the language model against the words, either way", async () => {
      decides("Is a kind of garlic", 0.4);
      answersAbout("clove", "kind-of", true);
      decides("Is a kind of garlic", 0.9);
      const cloves = await resolveOne("garlic cloves crushed");

      await expect(ingredientFor(cloves.aliasId)).resolves.toMatchObject({ flagged: false });
      expect(await parentOf(cloves.ingredientId)).toBe(seeded.get("en:garlic"));

      decides("Is a kind of garlic", 0.4);
      answersAbout("clove", "kind-of", true);
      decides("Is a kind of clove", 0.9);
      const sliced = await resolveOne("garlic bulb cloves");

      expect(sliced.ingredientId).not.toBe(cloves.ingredientId);
      expect(await parentOf(sliced.ingredientId)).toBe(seeded.get("en:clove"));
      expect(vi.mocked(decide)).toHaveBeenCalledTimes(4);
    });

    it("keeps the language model's answer where the Decision cannot settle it, or there is none", async () => {
      decides("Is a kind of garlic", 0.4);
      answersAbout("clove", "kind-of", true);
      decides("Is a kind of garlic", 0.6);
      const undecided = await resolveOne("garlic cloves crushed");

      expect(await parentOf(undecided.ingredientId)).toBe(seeded.get("en:clove"));

      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
      answersAbout("clove", "kind-of", true);
      const alone = await resolveOne("garlic bulb cloves");

      expect(await parentOf(alone.ingredientId)).toBe(seeded.get("en:clove"));
      await expect(ingredientFor(alone.aliasId)).resolves.toMatchObject({ flagged: false });
    });

    it("falls back to the words, with a question for a person, where AI is unsure and names nothing", async () => {
      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
      answers({ verdict: "new", food: null, sure: false });
      const cloves = await resolveOne("garlic cloves crushed");

      await expect(ingredientFor(cloves.aliasId)).resolves.toMatchObject({
        flagged: true,
        flagReason: "ai-unsure",
      });
      expect(await parentOf(cloves.ingredientId)).toBe(seeded.get("en:garlic"));
      expect(await listIngredientSuggestions()).toMatchObject([{ source: "words" }]);
    });
  });

  it("asks once for texts in one call that resolve alike", async () => {
    const onion = await known("onion");

    decides("Is onion", 0.95);
    const [diced, bare] = await resolveIngredients(["onions, diced", "onions (2)"], { userId });

    expect(diced!.ingredientId).toBe(onion.ingredientId);
    expect(bare!.ingredientId).toBe(onion.ingredientId);
    expect(vi.mocked(decide)).toHaveBeenCalledTimes(1);
  });
});
