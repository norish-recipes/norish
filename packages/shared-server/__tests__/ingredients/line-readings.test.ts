// @vitest-environment node
/**
 * Reading another household's recipe lines through the reader's catalogue (ADR-0042), against a
 * real database: which lines are read again, what they read as, and that a read writes nothing.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { createRecipeWithRefs, getRecipeFull } from "@norish/db";
import { joinHousehold, moveToHouseholdOfOne } from "@norish/db/repositories/households";
import { listLibrary } from "@norish/db/repositories/library";
import { listRecipes } from "@norish/db/repositories/recipes";
import { setConfig } from "@norish/db/repositories/server-config";
import { readLinesThrough } from "@norish/shared-server/ingredients/line-readings";
import { onIngredientsMinted } from "@norish/shared-server/ingredients/minted";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";

import {
  addTestPantryIngredient,
  countTestCatalogueRows,
  createTestIngredient,
  createTestUser,
  householdIdOf,
  mintTestFood,
  testHouseholdOf,
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
    const readings = await readLinesThrough(testHouseholdOf(reader), { recipeIds: [recipeId] });

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
      readLinesThrough(testHouseholdOf(author), { recipeIds: [recipeId] })
    ).resolves.toEqual({});
  });

  it("reads a slip of the reader's food as no food rather than writing a spelling", async () => {
    await mintTestFood(testHouseholdOf(reader), "parmezaan");
    const { lines } = await recipe(author, ["parmezan"]);
    const before = await countTestCatalogueRows();

    await expect(
      readLinesThrough(testHouseholdOf(reader), { lineIds: [lines[0]!.id!] })
    ).resolves.toEqual({ [lines[0]!.id!]: { ingredientId: null, joined: null, foods: [] } });
    await expect(countTestCatalogueRows()).resolves.toEqual(before);
  });

  it("reads a leaver's own recipe again while its lines name the old household's food", async () => {
    await joinHousehold(reader, { householdId: testHouseholdOf(author) });
    const { recipeId, lines } = await recipe(reader, ["kapucijners"]);

    await moveToHouseholdOfOne(testHouseholdOf(author), reader);
    const own = await mintTestFood(await householdIdOf(reader), "kapucijners");

    await expect(
      readLinesThrough(await householdIdOf(reader), { recipeIds: [recipeId] })
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
    const lineReadings = await readLinesThrough(viewer.householdId, "visible");
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
});
