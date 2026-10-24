// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogueActor } from "@norish/shared-server/ingredients/catalogue";
import { getRecipeFull } from "@norish/db";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { writeArchive } from "./norish-fixtures";

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn(),
  saveStepImageBytes: vi.fn(),
  saveVideoBytes: vi.fn(),
}));

const { extractNorishRecipes, parseNorishRecipeToDTO } =
  await import("@norish/shared-server/archive/norish-parser");
const { createResolvedRecipe } = await import("@norish/shared-server/ingredients/recipe-lines");
const { listSpellings, removeAlias, renameIngredient } =
  await import("@norish/shared-server/ingredients/catalogue");

/** A recipe exported from the database and imported back: its lines name the same foods. */
describe("a Recipe Archive round trip", () => {
  const testBase = new RepositoryTestBase("test_norish_archive_foods");

  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A recipe of these lines, resolved as a save resolves them; its id. */
  async function recipeOf(texts: string[]): Promise<string> {
    const id = crypto.randomUUID();

    await createResolvedRecipe(
      id,
      userId,
      {
        name: "Pasta",
        systemUsed: "metric",
        recipeIngredients: texts.map((ingredientName, order) => ({
          ingredientId: null,
          ingredientName,
          amount: null,
          unit: null,
          order,
        })),
        steps: [],
        tags: [],
        cuisines: [],
      },
      { userId }
    );

    return id;
  }

  /** The recipe written to an archive and imported back, `edit` given its recipe.json first; its id. */
  async function roundTrip(
    sourceId: string,
    edit: (json: Record<string, unknown>) => void = () => {}
  ): Promise<string> {
    const archive = await writeArchive({
      records: [{ recipe: (await getRecipeFull(sourceId))!, media: [] }],
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-10-18T12:00:00Z"),
    });
    const [entry] = await extractNorishRecipes(archive);
    const importedId = crypto.randomUUID();

    edit(entry!.json as Record<string, unknown>);

    const { dto } = await parseNorishRecipeToDTO(
      entry!.json,
      importedId,
      new Map(),
      archive.folder(entry!.folderKey)
    );

    await createResolvedRecipe(importedId, userId, dto, { userId });

    return importedId;
  }

  const lines = (id: string) =>
    getRecipeFull(id).then((recipe) =>
      recipe!.recipeIngredients.map(({ ingredientName, ingredientId, joined, foods }) => ({
        ingredientName,
        ingredientId,
        joined: joined ?? null,
        foods: foods?.map((food) => food.ingredientId),
      }))
    );

  /** Rename a recipe's first food and remove every other spelling, so its line's text names it no more. */
  async function respell(recipeId: string, spelling: string): Promise<void> {
    const actor: CatalogueActor = { userId, householdUserIds: null, isServerAdmin: false };
    const ingredientId = (await getRecipeFull(recipeId))!.recipeIngredients[0]!.ingredientId!;

    await renameIngredient(actor, ingredientId, spelling);
    for (const old of await listSpellings(actor, ingredientId)) {
      if (old.text !== spelling) await removeAlias(actor, old.id);
    }
  }

  it("keeps every line's food", async () => {
    const sourceId = await recipeOf([
      "2 onions, diced",
      "boter",
      "# Saus",
      "100 g parmezaan, geraspt",
    ]);
    const before = await lines(sourceId);

    expect(before.filter((line) => line.ingredientId !== null)).toHaveLength(3);
    await expect(roundTrip(sourceId).then(lines)).resolves.toEqual(before);
  });

  it("keeps the food of a line whose spelling was removed, under the food's other spelling", async () => {
    const sourceId = await recipeOf(["2 gyoza vellen"]);

    await respell(sourceId, "dumplingvellen");

    const before = await lines(sourceId);

    await expect(roundTrip(sourceId).then(lines)).resolves.toEqual(before);
  });

  it("keeps every food of a line naming several, in order and joined as they were", async () => {
    await recipeOf(["zout", "peper", "boter", "olie"]);

    const sourceId = await recipeOf(["zout en peper", "boter of olie"]);

    await respell(sourceId, "keukenzout");

    const before = await lines(sourceId);

    expect(before).toMatchObject([
      { joined: "together", foods: [expect.any(String), expect.any(String)] },
      { joined: "alternatives", foods: [expect.any(String), expect.any(String)] },
    ]);
    await expect(roundTrip(sourceId).then(lines)).resolves.toEqual(before);
  });

  it("reads a line of an archive without foods from its text, as before", async () => {
    const sourceId = await recipeOf(["2 gyoza vellen"]);

    await respell(sourceId, "dumplingvellen");

    const importedId = await roundTrip(sourceId, (json) => {
      for (const line of json.recipeIngredients as Array<Record<string, unknown>>) {
        delete line.foods;
        delete line.joined;
      }
    });
    const [[source], [imported]] = await Promise.all([lines(sourceId), lines(importedId)]);

    expect(imported!.ingredientName).toBe("2 gyoza vellen");
    expect(imported!.ingredientId).not.toBe(source!.ingredientId);
  });
});
