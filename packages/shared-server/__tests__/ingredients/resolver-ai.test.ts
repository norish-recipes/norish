// @vitest-environment node
/**
 * The ingredient resolver with AI on, against a real database: an import, a save or a typed
 * grocery asks AI nothing. A name nothing known matches is minted flagged and handed to AI's pass,
 * which answers afterwards. The Decision is mocked at `decide` and the language model at the
 * runtime's `generateStructured`; the configuration says whether either may be asked.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import { listAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import { findIngredientByAliasId } from "@norish/db/repositories/ingredient-aliases";
import { deleteCatalogueIngredient } from "@norish/db/repositories/ingredient-catalogue";
import { listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import { findIngredientAncestors } from "@norish/db/repositories/ingredient-relocation";
import { ingredients } from "@norish/db/schema";
import { decide, generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import {
  isAIEnabled,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { undoAIChange } from "@norish/shared-server/ingredients/ai-changes";
import { resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { onIngredientsMinted } from "@norish/shared-server/ingredients/minted";
import {
  updateResolvedRecipe,
  withResolvedIngredients,
} from "@norish/shared-server/ingredients/recipe-lines";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { askAIAbout } from "@norish/shared-server/ingredients/review";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { foodReading, noFoodReading } from "../helpers/ingredient-readings";

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
}));
vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAIEnabled: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

/** The language model's answers, in order; a Plain Name nobody queued is none. */
let modelAnswers: unknown[] = [];

describe("ingredient resolver with AI on", () => {
  const testBase = new RepositoryTestBase("test_ingredient_resolver_ai");

  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    modelAnswers = [];
    vi.mocked(decide).mockReset();
    vi.mocked(generateStructured)
      .mockReset()
      .mockImplementation((async ({ prompt }: { prompt: string }) => {
        if (prompt === "ingredient-plain-name") return { plainName: null };
        if (modelAnswers.length === 0) throw new Error("no answer queued");

        return modelAnswers.shift();
      }) as never);
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

  async function saved(texts: string[]) {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(
      recipeId,
      userId,
      await withResolvedIngredients(
        {
          name: "Hot dogs",
          systemUsed: "metric",
          recipeIngredients: texts.map((ingredientName, order) => ({
            ingredientId: null,
            ingredientName,
            amount: null,
            unit: null,
            order,
          })),
        },
        { userId }
      )
    );

    return { recipeId, lines: (await getRecipeFull(recipeId))!.recipeIngredients };
  }

  function expectNoAIRequest() {
    expect(vi.mocked(decide)).not.toHaveBeenCalled();
    expect(vi.mocked(generateStructured)).not.toHaveBeenCalled();
  }

  it("saves a recipe asking AI nothing, minting what it does not know unflagged, and the pass answers after", async () => {
    const onion = await resolveOne("onion");
    const minted: string[] = [];

    onIngredientsMinted(async (ids) => void minted.push(...ids));
    try {
      const { lines } = await saved(["onion", "rode uien", "Dijon or yellow mustard"]);

      expectNoAIRequest();
      expect(lines).toMatchObject([
        { ingredientId: onion.ingredientId },
        { ingredientName: "rode uien", joined: null },
        { ingredientName: "Dijon or yellow mustard", joined: null },
      ]);
      // Both minted whole and unflagged, handed to the pass.
      for (const line of lines.slice(1)) {
        await expect(
          getTestDb().select().from(ingredients).where(eq(ingredients.id, line.ingredientId!))
        ).resolves.toMatchObject([{ name: line.ingredientName, flagged: false, flagReason: null }]);
      }
      expect(minted.sort()).toEqual(
        lines
          .slice(1)
          .map((line) => line.ingredientId)
          .sort()
      );

      // The pass reads "rode uien" as red onion, a kind of onion, and files it there.
      const red = lines[1]!.ingredientId!;

      modelAnswers.push(foodReading({ englishName: "red onion", parents: ["onion"], sure: true }));
      await expect(askAIAbout(red)).resolves.toMatchObject({ outcome: "parent", of: "onion" });
      await expect(findIngredientAncestors([red])).resolves.toEqual(
        new Map([[red, [onion.ingredientId]]])
      );
    } finally {
      onIngredientsMinted(undefined);
    }
  });

  it("mints a line that names no food, and the pass deletes it, listed on Changed by AI, Undo bringing it back with its line", async () => {
    const { recipeId, lines } = await saved(["melted"]);
    const melted = lines[0]!.foods![0]!;

    expectNoAIRequest();
    modelAnswers.push(noFoodReading(true));
    await expect(askAIAbout(melted.ingredientId)).resolves.toMatchObject({ outcome: "not-a-food" });
    await expect(getRecipeFull(recipeId)).resolves.toMatchObject({
      recipeIngredients: [{ ingredientName: "melted", ingredientId: null }],
    });

    const [change, ...others] = await listAIChanges();

    expect(others).toEqual([]);
    expect(change).toMatchObject({ sure: true, undo: { kind: "not-a-food" } });
    await undoAIChange({ userId, householdUserIds: null, isServerAdmin: false }, change!.id);
    await expect(getRecipeFull(recipeId)).resolves.toMatchObject({
      recipeIngredients: [{ ingredientName: "melted", ingredientId: melted.ingredientId }],
    });
  });

  it("puts what AI deleted as not a food on the junk pile: the next line naming it mints nothing and asks nothing, until Undo", async () => {
    const first = await saved(["melted"]);
    const melted = first.lines[0]!.foods![0]!;

    modelAnswers.push(noFoodReading(true));
    await askAIAbout(melted.ingredientId);
    await expect(listJunkFolds()).resolves.toEqual(["melted"]);
    vi.mocked(generateStructured).mockClear();
    const minted: string[] = [];

    onIngredientsMinted(async (ids) => void minted.push(...ids));
    try {
      const again = await saved(["melted"]);

      expectNoAIRequest();
      expect(minted).toEqual([]);
      expect(again.lines).toMatchObject([{ ingredientName: "melted", ingredientId: null }]);
      await expect(
        getTestDb().select().from(ingredients).where(eq(ingredients.name, "melted"))
      ).resolves.toEqual([]);
    } finally {
      onIngredientsMinted(undefined);
    }

    const [change] = await listAIChanges();

    await undoAIChange({ userId, householdUserIds: null, isServerAdmin: false }, change!.id);
    await expect(listJunkFolds()).resolves.toEqual([]);
    const restored = await saved(["melted"]);

    expect(restored.lines).toMatchObject([{ ingredientId: melted.ingredientId }]);
  });

  it("adds a grocery it does not know asking AI nothing", async () => {
    const [typed] = await resolveGroceryNames([{ name: "Unox Knaks" }], { userId });

    expectNoAIRequest();
    await expect(findIngredientByAliasId(typed!.aliasId)).resolves.toMatchObject({
      name: "Unox Knaks",
      flagged: false,
    });
  });

  it("flags nothing it mints with AI off either", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false);
    const cloves = await resolveOne("garlic cloves");

    expectNoAIRequest();
    await expect(findIngredientByAliasId(cloves.aliasId)).resolves.toMatchObject({
      flagged: false,
      flagReason: null,
    });
  });

  it("keeps the foods of a saved recipe's unchanged lines, and resolves only the edited one", async () => {
    const shallot = await resolveOne("shallot");
    const carrot = await resolveOne("carrot");
    const tomato = await resolveOne("tomato");
    await resolveOne("onion");
    await resolveOne("leek");
    const recipeId = crypto.randomUUID();
    const lines = [
      // An import named the food; the line's own text names another.
      {
        ingredientId: null,
        ingredientName: "onion bulbs, chopped",
        foodTexts: ["shallot"],
        amount: 2,
        unit: null,
        order: 0,
      },
      { ingredientId: null, ingredientName: "leek", amount: 1, unit: null, order: 1 },
      {
        ingredientId: null,
        ingredientName: "GR CHERRYTOMATEN",
        foodTexts: ["tomato"],
        amount: 150,
        unit: null,
        order: 2,
      },
    ];

    await createRecipeWithRefs(
      recipeId,
      userId,
      await withResolvedIngredients(
        { name: "Soup", systemUsed: "metric", recipeIngredients: lines },
        { userId }
      )
    );
    const [kept, edited, reparsed] = (await getRecipeFull(recipeId))!.recipeIngredients;

    await updateResolvedRecipe(
      recipeId,
      userId,
      {
        systemUsed: "metric",
        recipeIngredients: [
          { id: kept!.id, ingredientName: "onion bulbs, chopped", amount: 2, unit: null, order: 0 },
          { id: edited!.id, ingredientName: "carrots", amount: 1, unit: null, order: 1 },
          // The editor shows "150 GR CHERRYTOMATEN" and parses it back with the unit apart.
          { id: reparsed!.id, ingredientName: "CHERRYTOMATEN", amount: 150, unit: "GR", order: 2 },
        ],
      },
      { userId }
    );

    expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
      { id: kept!.id, ingredientId: shallot.ingredientId },
      { id: edited!.id, ingredientId: carrot.ingredientId },
      { id: reparsed!.id, ingredientId: tomato.ingredientId },
    ]);
  });

  it("keeps a saved line whose food was deleted without one, rather than minting it again", async () => {
    const { recipeId, lines } = await saved(["deegroller", "flour"]);
    const [tool, flour] = lines;

    await withTransaction((tx) => deleteCatalogueIngredient(tx, tool!.ingredientId!));
    await updateResolvedRecipe(
      recipeId,
      userId,
      {
        systemUsed: "metric",
        recipeIngredients: [
          { id: tool!.id, ingredientName: "deegroller", amount: null, unit: null, order: 0 },
          { id: flour!.id, ingredientName: "flour", amount: 250, unit: "g", order: 1 },
        ],
      },
      { userId }
    );

    expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
      { id: tool!.id, ingredientName: "deegroller", ingredientId: null },
      { id: flour!.id, ingredientId: flour!.ingredientId },
    ]);
  });

  describe("a slip of the fingers", () => {
    it("takes the known food a text is one slip of, AI on or off", async () => {
      const parmesan = await resolveOne("parmezaan");
      const [late, early] = await resolveIngredients(["parmezan", "parmesaan"], { userId });

      expect(late).toMatchObject({ ingredientId: parmesan.ingredientId });
      expect(early).toMatchObject({ ingredientId: parmesan.ingredientId });
      // The slip joins as a spelling of its own, which a person can move where it is wrong.
      expect(late!.aliasId).not.toBe(parmesan.aliasId);

      vi.mocked(isAIEnabled).mockResolvedValue(false);
      expect((await resolveOne("parmezaam")).ingredientId).toBe(parmesan.ingredientId);
      expectNoAIRequest();
    });

    it("takes no slip under five letters, of the first letter, nor one two foods are equally near", async () => {
      const [meel, parmesan] = await resolveIngredients(["meel", "parmezaan"], { userId });
      const [chilli, sause] = await resolveIngredients(["chilli sauce", "chili sause"], { userId });
      const [melk, barmezaan, chili] = await resolveIngredients(
        ["melk", "barmezaan", "chili sauce"],
        { userId }
      );

      expect(melk!.ingredientId).not.toBe(meel!.ingredientId);
      expect(barmezaan!.ingredientId).not.toBe(parmesan!.ingredientId);
      expect([chilli!.ingredientId, sause!.ingredientId]).not.toContain(chili!.ingredientId);
    });
  });
});
