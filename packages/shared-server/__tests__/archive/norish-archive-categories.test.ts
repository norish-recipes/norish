// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getRecipeFull } from "@norish/db";
import { listCategoryNamesForUsers } from "@norish/db/repositories/categories";

import { createTestUser } from "../../../db/__tests__/helpers/db-test-helpers";
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

/** A recipe exported by one household and imported by another keeps its Categories. */
describe("a Recipe Archive carries Categories", () => {
  const testBase = new RepositoryTestBase("test_norish_archive_categories");

  let exporterId: string;
  let importerId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    exporterId = user.id;
    importerId = (await createTestUser()).id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A recipe of the exporter's carrying `categories`, through an archive into the importer's library. */
  async function exportAndImport(
    categories: string[],
    edit: (json: Record<string, unknown>) => void = () => {}
  ): Promise<string> {
    const sourceId = crypto.randomUUID();
    const recipe = {
      name: "Mojito",
      systemUsed: "metric" as const,
      recipeIngredients: [],
      steps: [],
      tags: [],
      cuisines: [],
    };

    await createResolvedRecipe(
      sourceId,
      exporterId,
      { ...recipe, categories },
      {
        userId: exporterId,
      }
    );

    const archive = await writeArchive({
      records: [{ recipe: (await getRecipeFull(sourceId))!, media: [] }],
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-11-07T12:00:00Z"),
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

    await createResolvedRecipe(importedId, importerId, dto, { userId: importerId });

    return importedId;
  }

  it("gives the importer a household Category it did not have", async () => {
    expect(await listCategoryNamesForUsers([importerId])).not.toContain("Drinks");

    const importedId = await exportAndImport(["Drinks", "Snack"]);

    expect((await getRecipeFull(importedId))?.categories).toEqual(["Drinks", "Snack"]);
    expect(await listCategoryNamesForUsers([importerId])).toContain("Drinks");
  });

  it("names a built-in by its translation and creates any other name as it is", async () => {
    const importedId = await exportAndImport([], (json) => {
      json.categories = ["ontbijt", "Desserts"];
    });

    expect((await getRecipeFull(importedId))?.categories).toEqual(["Breakfast", "Desserts"]);
  });
});
