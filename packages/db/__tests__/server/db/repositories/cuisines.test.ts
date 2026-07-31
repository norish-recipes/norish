// @vitest-environment node
/**
 * Cuisine vocabulary persistence.
 *
 * The vocabulary is administrator-owned, so these tests are about governance
 * rather than storage mechanics: a rename must not touch recipes, and a delete
 * must cascade to the join rows without touching recipes either.
 */

import { eq, notInArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  attachRecipeCuisines,
  createCuisine,
  createCuisines,
  deleteCuisine,
  findCuisineByName,
  getRecipeCuisines,
  listCuisines,
  renameCuisine,
} from "@norish/db/repositories/cuisines";
import { cuisines, recipeCuisines, recipes } from "@norish/db/schema";

import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("Cuisine repository", () => {
  let recipeId: string;
  let seededIds: string[];
  const testBase = new RepositoryTestBase("test_cuisines");

  async function readRecipeRow() {
    return await db
      .select({ version: recipes.version, updatedAt: recipes.updatedAt })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
  }

  beforeAll(async () => {
    await testBase.setup();

    seededIds = (await listCuisines()).map((cuisine) => cuisine.id);
  });

  beforeEach(async () => {
    const [, recipe] = await testBase.beforeEachTest();

    recipeId = recipe.id;

    // The seeded vocabulary is migration state and survives; rows a test added
    // do not, so each test starts from the shipped list.
    await db.delete(cuisines).where(notInArray(cuisines.id, seededIds));
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("seeded vocabulary", () => {
    it("ships a starting vocabulary", async () => {
      const vocabulary = await listCuisines();

      expect(vocabulary.length).toBeGreaterThan(10);
    });

    it("covers every cuisine that was a predefined auto-tagging Tag", async () => {
      const names = (await listCuisines()).map((cuisine) => cuisine.name.toLowerCase());

      for (const legacy of [
        "italian",
        "mexican",
        "asian",
        "american",
        "mediterranean",
        "indian",
        "french",
        "thai",
        "japanese",
        "chinese",
      ]) {
        expect(names).toContain(legacy);
      }
    });

    it("excludes Other, because an empty Cuisine set already means nothing fits", async () => {
      const names = (await listCuisines()).map((cuisine) => cuisine.name.toLowerCase());

      expect(names).not.toContain("other");
    });
  });

  describe("administration", () => {
    it("adds a Cuisine", async () => {
      const created = await createCuisine("Basque");

      expect(created.name).toBe("Basque");
      expect(await findCuisineByName("basque")).not.toBeNull();
    });

    it("rejects a duplicate regardless of case or surrounding whitespace", async () => {
      await createCuisine("Basque");

      await expect(createCuisine("  basque ")).rejects.toThrow();
    });

    it("renames a Cuisine without writing any recipe", async () => {
      const created = await createCuisine("Basque");

      await attachRecipeCuisines(recipeId, [created.id]);

      const before = await readRecipeRow();
      const renamed = await renameCuisine(created.id, "Basque Country");

      expect(renamed?.name).toBe("Basque Country");
      expect(await readRecipeRow()).toEqual(before);

      // Every recipe referencing the row follows the rename by construction.
      expect(await getRecipeCuisines(recipeId)).toEqual([
        expect.objectContaining({ name: "Basque Country" }),
      ]);
    });

    it("deletes a Cuisine, cascading to the join rows and touching no recipe", async () => {
      const created = await createCuisine("Basque");

      await attachRecipeCuisines(recipeId, [created.id]);

      const before = await readRecipeRow();

      expect(await deleteCuisine(created.id)).toBe(true);
      expect(await readRecipeRow()).toEqual(before);

      const joinRows = await db
        .select()
        .from(recipeCuisines)
        .where(eq(recipeCuisines.recipeId, recipeId));

      expect(joinRows).toHaveLength(0);
      expect(await findCuisineByName("Basque")).toBeNull();
    });

    it("reports a delete of something that is not there", async () => {
      expect(await deleteCuisine("00000000-0000-0000-0000-000000000000")).toBe(false);
    });

    it("adds several Cuisines at once for the extend strategy", async () => {
      const created = await createCuisines(["Basque", "Galician"]);

      expect(created.map((cuisine) => cuisine.name).sort()).toEqual(["Basque", "Galician"]);
    });

    it("tolerates a name that is already there, so two runs cannot collide", async () => {
      await createCuisines(["Basque"]);

      const second = await createCuisines(["Basque", "Galician"]);

      expect(second.map((cuisine) => cuisine.name).sort()).toEqual(["Basque", "Galician"]);
      expect((await listCuisines()).filter((c) => c.name === "Basque")).toHaveLength(1);
    });

    it("refuses a rename onto a name that already exists", async () => {
      const created = await createCuisine("Basque");

      await createCuisine("Galician");

      await expect(renameCuisine(created.id, "galician")).rejects.toThrow();
    });
  });
});
