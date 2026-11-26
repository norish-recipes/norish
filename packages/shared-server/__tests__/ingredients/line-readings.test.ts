// @vitest-environment node
/**
 * Reading another household's recipe lines through the reader's catalogue (ADR-0042), against a
 * real database: which lines are read again, what they read as, and that a read writes nothing.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { addRecipesToCookbook, createCookbook } from "@norish/db/repositories/cookbooks";
import { joinHousehold, moveToHouseholdOfOne } from "@norish/db/repositories/households";
import { listLibrary } from "@norish/db/repositories/library";
import { listRecipes } from "@norish/db/repositories/recipes";
import { setConfig } from "@norish/db/repositories/server-config";
import { groceryParts, resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { lineReadingsOf } from "@norish/shared-server/ingredients/line-readings";
import { onIngredientsMinted } from "@norish/shared-server/ingredients/minted";
import { addPickedToPantry } from "@norish/shared-server/ingredients/pantry";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import { foodsToBuy, linesAsRead } from "@norish/shared/lib/line-foods";
import { nutritionLinesOf } from "@norish/shared/lib/recipe-nutrition";

import {
  addTestPantryIngredient,
  addTestSpelling,
  countTestCatalogueRows,
  createTestIngredient,
  createTestUser,
  householdIdOf,
  mintTestFood,
  readTestIngredient,
  readTestSpelling,
  testHouseholdOf,
  testPantrySpellings,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("lines read through the reader's catalogue", () => {
  const testBase = new RepositoryTestBase("test_line_readings");
  const announced: string[] = [];
  let author: string;
  let reader: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    author = user.id;
    reader = (await createTestUser())!.id;
    onIngredientsMinted(async (ids) => void announced.push(...ids));
  });

  afterEach(() => onIngredientsMinted(undefined));

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A recipe of `ownerId`'s with these lines, resolved in its household; its lines in order. */
  async function recipe(ownerId: string, texts: string[]) {
    const recipeId = crypto.randomUUID();

    await createRecipeWithRefs(
      recipeId,
      ownerId,
      await withResolvedIngredients(
        {
          name: "Soup",
          systemUsed: "metric",
          recipeIngredients: texts.map((ingredientName, order) => ({
            ingredientId: null,
            ingredientName,
            amount: 1,
            unit: null,
            order,
          })),
        },
        { userId: ownerId, householdId: await householdIdOf(ownerId) }
      )
    );

    return { recipeId, lines: (await getRecipeFull(recipeId))!.recipeIngredients };
  }

  it("reads only lines naming another household's food, as the reader's food or none", async () => {
    await createTestIngredient({ name: "zout" });
    const ui = await mintTestFood(testHouseholdOf(reader), "ui");
    const {
      recipeId,
      lines: [uiLine, zoutLine, preiLine],
    } = await recipe(author, ["ui", "zout", "prei"]);
    const before = await countTestCatalogueRows();

    announced.length = 0;
    const readings = await lineReadingsOf(testHouseholdOf(reader), {
      of: "recipes",
      ids: [recipeId],
    });

    expect(readings).toEqual({
      [uiLine!.id!]: {
        ingredientId: ui.ingredientId,
        joined: null,
        foods: [{ ingredientId: ui.ingredientId, name: "ui" }],
      },
      // Nothing in the reader's catalogue spells it: no food, and none minted.
      [preiLine!.id!]: { ingredientId: null, joined: null, foods: [] },
    });
    expect(readings[zoutLine!.id!]).toBeUndefined();
    await expect(countTestCatalogueRows()).resolves.toEqual(before);
    expect(announced).toEqual([]);
    // The author reads their own recipe as stored.
    await expect(
      lineReadingsOf(testHouseholdOf(author), { of: "recipes", ids: [recipeId] })
    ).resolves.toEqual({});
  });

  it("reads only a cookbook's lines for that cookbook", async () => {
    const inBook = await recipe(author, ["ui"]);
    const outside = await recipe(author, ["prei"]);
    const cookbook = await createCookbook({ userId: author, title: "Soups" });

    await addRecipesToCookbook(cookbook.id, [inBook.recipeId]);

    expect(
      Object.keys(
        await lineReadingsOf(testHouseholdOf(reader), { of: "cookbook", id: cookbook.id })
      )
    ).toEqual([inBook.lines[0]!.id]);
    expect(
      Object.keys(await lineReadingsOf(testHouseholdOf(reader), { of: "visible" })).sort()
    ).toEqual([inBook.lines[0]!.id, outside.lines[0]!.id].sort());
  });

  it("reads a slip of the reader's food as no food rather than writing a spelling", async () => {
    await mintTestFood(testHouseholdOf(reader), "parmezaan");
    const { lines } = await recipe(author, ["parmezan"]);
    const before = await countTestCatalogueRows();

    await expect(
      lineReadingsOf(testHouseholdOf(reader), { of: "lines", ids: [lines[0]!.id!] })
    ).resolves.toEqual({ [lines[0]!.id!]: { ingredientId: null, joined: null, foods: [] } });
    await expect(countTestCatalogueRows()).resolves.toEqual(before);
  });

  it("reads a leaver's own recipe again while its lines name the old household's food", async () => {
    await joinHousehold(reader, { householdId: testHouseholdOf(author) });
    const { recipeId, lines } = await recipe(reader, ["kapucijners"]);

    await moveToHouseholdOfOne(testHouseholdOf(author), reader);
    const own = await mintTestFood(await householdIdOf(reader), "kapucijners");

    await expect(
      lineReadingsOf(await householdIdOf(reader), { of: "recipes", ids: [recipeId] })
    ).resolves.toEqual({
      [lines[0]!.id!]: {
        ingredientId: own.ingredientId,
        joined: null,
        foods: [{ ingredientId: own.ingredientId, name: "kapucijners" }],
      },
    });
  });

  it("covers another household's line by the reader's Pantry, a line it cannot read by none", async () => {
    await setConfig(
      ServerConfigKeys.RECIPE_PERMISSION_POLICY,
      { view: "everyone", edit: "household", delete: "household" },
      null,
      false
    );
    const ui = await mintTestFood(testHouseholdOf(reader), "ui");

    await addTestPantryIngredient(reader, ui);
    await recipe(author, ["ui", "prei"]);
    const viewer = { userId: reader, householdId: testHouseholdOf(reader) };
    const before = await countTestCatalogueRows();
    const lineReadings = await lineReadingsOf(viewer.householdId, { of: "visible" });
    const library = await listLibrary(viewer, { limit: 10, pantryOnly: true, lineReadings });
    const members = await listRecipes(
      viewer,
      10,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { pantryOnly: true, lineReadings }
    );

    expect(
      library.items.map((item) => (item.kind === "recipe" ? item.recipe.pantryCoverage : null))
    ).toEqual([0.5]);
    expect(members.recipes.map((one) => one.pantryCoverage)).toEqual([0.5]);
    // Read as stored, the other household's food is in no Pantry of the reader's.
    await expect(listLibrary(viewer, { limit: 10, pantryOnly: true })).resolves.toMatchObject({
      total: 0,
    });
    await expect(countTestCatalogueRows()).resolves.toEqual(before);
  });

  it("means one thing for the list, the Pantry and nutrition", async () => {
    const household = testHouseholdOf(reader);
    const ui = await createTestIngredient({ name: "Ui" });
    const knoflook = await createTestIngredient({ name: "Knoflook" });
    const prei = await createTestIngredient({ name: "Prei" });
    const tomaten = await createTestIngredient({ name: "Cherrytomaten" });

    await addTestSpelling(ui!.id, "uien");
    // The reader's household spells "ui" for its own food: the seed's name means that one here.
    await addTestSpelling((await mintTestFood(household, "sjalot")).ingredientId, "ui");
    for (const own of ["knoflook", "prei", "cherrytomaten"])
      await mintTestFood(testHouseholdOf(author), own);
    const { recipeId, lines } = await recipe(author, [
      "uien en knoflook",
      "prei, knoflook",
      "GR CHERRYTOMATEN",
    ]);
    const readings = await lineReadingsOf(household, { of: "recipes", ids: [recipeId] });
    const expected = [[ui!.id, knoflook!.id], [prei!.id, knoflook!.id], [tomaten!.id]];

    expect(lines.map((line) => readings[line.id!]?.foods.map((food) => food.ingredientId))).toEqual(
      expected
    );

    // The add sheet sends each food it shows, read through or as stored, or the line as written.
    const actor = { userId: reader, householdId: household };
    const added = async (sent: Array<{ ingredientName: string; lineId?: string }>) => {
      const parts = (
        await groceryParts(
          household,
          sent.map((one) => ({ name: one.ingredientName, recipeIngredientId: one.lineId }))
        )
      ).flat();
      const foods = await resolveGroceryNames(parts, actor);

      return lines.map((line) =>
        parts.flatMap((part, index) =>
          part.recipeIngredientId === line.id ? [foods[index]?.ingredientId] : []
        )
      );
    };

    await expect(added(foodsToBuy(linesAsRead(lines, readings)))).resolves.toEqual(expected);
    await expect(
      added(lines.map((line) => ({ ingredientName: line.ingredientName, lineId: line.id })))
    ).resolves.toEqual(expected);

    const nutrition = nutritionLinesOf(
      {
        servings: 1,
        systemUsed: "metric",
        calories: null,
        fat: null,
        carbs: null,
        protein: null,
        recipeIngredients: lines,
      },
      readings
    );

    expect(nutrition.map((line) => line.ingredientId)).toEqual(expected.flatMap((ids) => ids));
    for (const id of [ui!.id, knoflook!.id, prei!.id, tomaten!.id]) {
      await addTestPantryIngredient(reader, { ingredientId: id });
    }
    const viewer = { userId: reader, householdId: household };
    const library = await listLibrary(viewer, {
      limit: 10,
      pantryOnly: true,
      lineReadings: readings,
    });

    expect(
      library.items.map((item) => (item.kind === "recipe" ? item.recipe.pantryCoverage : null))
    ).toEqual([1]);
  });

  it("keeps another household's line in the reader's Pantry as the reader's food", async () => {
    const household = testHouseholdOf(reader);
    const ui = await mintTestFood(household, "ui");
    const {
      lines: [uiLine, tomatenLine],
    } = await recipe(author, ["ui", "GR CHERRYTOMATEN"]);
    const actor = { userId: reader, householdId: household };
    // The sheet could not read the lines, so it keeps the stored foods.
    const kept = async (line: typeof uiLine) =>
      (
        await addPickedToPantry(crypto.randomUUID(), {
          ...actor,
          ingredientId: line!.ingredientId!,
          recipeIngredientId: line!.id,
        })
      ).map(({ item }) => item.ingredientId);

    await expect(kept(uiLine)).resolves.toEqual([ui.ingredientId]);
    const [row] = await testPantrySpellings(reader);

    expect((await readTestSpelling(row!.ingredientAliasId!))?.householdId).toBe(household);
    const [tomaten] = await kept(tomatenLine);

    // A line it reads as no food is its own text, resolved (here minted) in the reader's household.
    expect((await readTestIngredient(tomaten!))?.householdId).toBe(household);
    expect((await readTestIngredient(tomaten!))?.name).toBe("CHERRYTOMATEN");
    await expect(
      addPickedToPantry(crypto.randomUUID(), { ...actor, ingredientId: uiLine!.ingredientId! })
    ).resolves.toEqual([]);
  });
});
