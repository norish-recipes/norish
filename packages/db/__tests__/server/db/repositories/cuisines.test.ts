// @vitest-environment node
/**
 * Cuisines (ADR-0012, ADR-0043): the shipped vocabulary is the instance's, an administrator
 * changes it, and a household's own sit beside it. A rename or delete never writes a recipe row.
 */

import { eq, notInArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import { cuisinesForNames, getRecipeCuisines } from "@norish/db/repositories/cuisines";
import {
  addEntry,
  deleteEntry,
  listEntryRows,
  renameEntry,
  replaceRecipeEntryIdsTx,
} from "@norish/db/repositories/list-entries";
import { cuisines, recipes } from "@norish/db/schema";

import { testHouseholdOf } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("Cuisine repository", () => {
  let recipeId: string;
  let householdId: string;
  let seededIds: string[];
  const listCuisines = () => listEntryRows("cuisine", householdId);
  const attach = (ids: string[]) =>
    db.transaction((tx) => replaceRecipeEntryIdsTx(tx, "cuisine", recipeId, ids));
  const testBase = new RepositoryTestBase("test_cuisines");

  async function readRecipeRow() {
    return await db
      .select({ version: recipes.version, updatedAt: recipes.updatedAt })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
  }

  beforeAll(async () => {
    await testBase.setup();

    seededIds = (await db.select({ id: cuisines.id }).from(cuisines)).map((cuisine) => cuisine.id);
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    recipeId = recipe.id;
    householdId = testHouseholdOf(user.id);

    // The seeded vocabulary is migration state and survives; rows a test added
    // do not, so each test starts from the shipped list.
    await db.delete(cuisines).where(notInArray(cuisines.id, seededIds));
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("seeded vocabulary", () => {
    it("ships a starting vocabulary of instance entries", async () => {
      const vocabulary = await listCuisines();

      expect(vocabulary.length).toBeGreaterThan(10);
      expect(vocabulary.every((cuisine) => cuisine.instance)).toBe(true);
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
    it("adds an instance Cuisine; a name already there answers that entry", async () => {
      const created = await addEntry("cuisine", null, "Basque");

      expect(created).toMatchObject({ created: true, entry: { name: "Basque", instance: true } });
      expect(await addEntry("cuisine", null, "  basque ")).toEqual({
        created: false,
        entry: created!.entry,
      });
      expect(await addEntry("cuisine", householdId, "BASQUE")).toEqual({
        created: false,
        entry: created!.entry,
      });
    });

    it("renames a Cuisine without writing any recipe", async () => {
      const created = (await addEntry("cuisine", null, "Basque"))!.entry;

      await attach([created.id]);

      const before = await readRecipeRow();
      const renamed = await renameEntry("cuisine", null, created, "Basque Country");

      expect(renamed).toMatchObject({
        value: { merged: false, entry: { name: "Basque Country" } },
      });
      expect(await readRecipeRow()).toEqual(before);
      expect(await getRecipeCuisines(recipeId)).toEqual([
        expect.objectContaining({ name: "Basque Country" }),
      ]);
    });

    it("merges a rename onto a name that already exists", async () => {
      const basque = (await addEntry("cuisine", null, "Basque"))!.entry;
      const galician = (await addEntry("cuisine", null, "Galician"))!.entry;

      await attach([basque.id, galician.id]);

      expect(await renameEntry("cuisine", null, basque, "galician")).toMatchObject({
        value: { merged: true, entry: { id: galician.id } },
      });
      expect((await getRecipeCuisines(recipeId)).map((c) => c.name)).toEqual(["Galician"]);
    });

    it("deletes a Cuisine off its recipes, answering how many, touching no recipe row", async () => {
      const created = (await addEntry("cuisine", null, "Basque"))!.entry;

      await attach([created.id]);

      const before = await readRecipeRow();

      expect(await deleteEntry("cuisine", null, created)).toMatchObject({ value: { detached: 1 } });
      expect(await readRecipeRow()).toEqual(before);
      expect(await getRecipeCuisines(recipeId)).toEqual([]);
      expect(await deleteEntry("cuisine", null, created)).toBeNull();
    });

    it("adds the extend strategy's Cuisines to the household, tolerating one already there", async () => {
      await cuisinesForNames(householdId, ["Basque"], { create: true });

      const second = await cuisinesForNames(householdId, ["basque", "Galician", "Italian"], {
        create: true,
      });

      expect(second.map((c) => [c.name, c.instance]).sort()).toEqual([
        ["Basque", false],
        ["Galician", false],
        ["Italian", true],
      ]);
      expect((await listCuisines()).filter((c) => c.name === "Basque")).toHaveLength(1);
      expect(await cuisinesForNames(householdId, ["Catalan"], { create: false })).toEqual([]);
    });

    it("creates no Cuisine over the bound, keeping the rest", async () => {
      const found = await cuisinesForNames(householdId, ["x".repeat(81), "Galician"], {
        create: true,
      });

      expect(found.map((c) => c.name)).toEqual(["Galician"]);
      expect((await listCuisines()).some((c) => c.name.length > 80)).toBe(false);
    });
  });
});
