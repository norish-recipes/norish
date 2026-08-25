// @vitest-environment node
/**
 * The Library union against a real database.
 *
 * This is the single most important seam in the feature: a mocked repository
 * cannot prove that a union orders anything, that paging over it has no gaps,
 * or that a matching cookbook lands above the ranked recipes (ADR-0026).
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { LibraryListParams } from "@norish/db/repositories/library";
import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { addRecipeToCookbook, createCookbook } from "@norish/db/repositories/cookbooks";
import { listLibrary } from "@norish/db/repositories/library";
import { deleteRecipeById } from "@norish/db/repositories/recipes";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import { cookbooks as cookbooksTable, recipeRatings } from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

type PermissionLevel = "everyone" | "household" | "owner";

function viewer(userId: string, householdUserIds: string[] | null = null): RecipeListContext {
  return { userId, householdUserIds, isServerAdmin: false };
}

async function setPolicy(level: PermissionLevel) {
  await setConfig(
    ServerConfigKeys.RECIPE_PERMISSION_POLICY,
    { view: level, edit: level, delete: level },
    null,
    false
  );
}

/** Titles in the order the union returned them, whatever kind each row is. */
function titles(items: Awaited<ReturnType<typeof listLibrary>>["items"]): string[] {
  return items.map((item) => (item.kind === "recipe" ? item.recipe.name : item.cookbook.title));
}

function kinds(items: Awaited<ReturnType<typeof listLibrary>>["items"]): string[] {
  return items.map((item) => item.kind);
}

describe("the Library union", () => {
  const testBase = new RepositoryTestBase("test_library");
  let ownerId: string;
  let strangerId: string;
  /** The recipe the shared setup makes; the mixed fixtures take it out. */
  let baseRecipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    ownerId = user.id;
    baseRecipeId = recipe.id;
    strangerId = (await createTestUser({ name: "Stranger" })).id;
    await deleteConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /**
   * Four rows whose titles and creation order deliberately disagree, so a
   * sort that only looks right by accident cannot pass.
   */
  async function seedMixedLibrary() {
    // The shared setup already made one recipe; take it out so these four
    // rows are the whole library and the expected orders are exact.
    await deleteRecipeById(baseRecipeId);

    const alphaRecipe = await createTestRecipe(ownerId, { name: "Aubergine bake" });
    const bravoCookbook = await createCookbook({ userId: ownerId, title: "Brunch" });
    const charlieRecipe = await createTestRecipe(ownerId, { name: "Carrot soup" });
    const deltaCookbook = await createCookbook({ userId: ownerId, title: "Dinner party" });

    return { alphaRecipe, bravoCookbook, charlieRecipe, deltaCookbook };
  }

  const base: LibraryListParams = { limit: 50, searchFields: ["title", "ingredients"] };

  describe("sorting", () => {
    it("interleaves both kinds under every sort mode", async () => {
      await seedMixedLibrary();

      const byTitleAsc = await listLibrary(viewer(ownerId), { ...base, sortMode: "titleAsc" });

      expect(titles(byTitleAsc.items)).toEqual([
        "Aubergine bake",
        "Brunch",
        "Carrot soup",
        "Dinner party",
      ]);
      expect(kinds(byTitleAsc.items)).toEqual(["recipe", "cookbook", "recipe", "cookbook"]);

      const byTitleDesc = await listLibrary(viewer(ownerId), { ...base, sortMode: "titleDesc" });

      expect(titles(byTitleDesc.items)).toEqual([
        "Dinner party",
        "Carrot soup",
        "Brunch",
        "Aubergine bake",
      ]);

      const byDateAsc = await listLibrary(viewer(ownerId), { ...base, sortMode: "dateAsc" });

      expect(titles(byDateAsc.items)).toEqual([
        "Aubergine bake",
        "Brunch",
        "Carrot soup",
        "Dinner party",
      ]);

      const byDateDesc = await listLibrary(viewer(ownerId), { ...base, sortMode: "dateDesc" });

      expect(titles(byDateDesc.items)).toEqual([
        "Dinner party",
        "Carrot soup",
        "Brunch",
        "Aubergine bake",
      ]);
    });

    it("counts both kinds in the total", async () => {
      await seedMixedLibrary();

      const result = await listLibrary(viewer(ownerId), base);

      expect(result.total).toBe(4);
    });
  });

  describe("paging", () => {
    it("produces no gaps and no repeats across pages", async () => {
      await seedMixedLibrary();

      const seen: string[] = [];

      for (let offset = 0; offset < 4; offset += 2) {
        const page = await listLibrary(viewer(ownerId), {
          ...base,
          limit: 2,
          offset,
          sortMode: "titleAsc",
        });

        expect(page.total).toBe(4);
        seen.push(...titles(page.items));
      }

      expect(seen).toEqual(["Aubergine bake", "Brunch", "Carrot soup", "Dinner party"]);
      expect(new Set(seen).size).toBe(4);
    });

    it("pages a run of identical titles without repeating a row", async () => {
      // Equal sort keys are exactly where a union without a tie-break drifts.
      for (let index = 0; index < 4; index += 1) {
        await createCookbook({ userId: ownerId, title: "Same name" });
      }

      const first = await listLibrary(viewer(ownerId), {
        ...base,
        limit: 2,
        offset: 0,
        sortMode: "titleAsc",
      });
      const second = await listLibrary(viewer(ownerId), {
        ...base,
        limit: 2,
        offset: 2,
        sortMode: "titleAsc",
      });
      const ids = [...first.items, ...second.items].map((item) =>
        item.kind === "cookbook" ? item.cookbook.id : item.recipe.id
      );

      expect(new Set(ids).size).toBe(4);
    });
  });

  describe("the type filter", () => {
    it("narrows the union rather than slicing a fetched page", async () => {
      await seedMixedLibrary();

      const recipesOnly = await listLibrary(viewer(ownerId), { ...base, type: "recipes" });

      expect(kinds(recipesOnly.items)).toEqual(["recipe", "recipe"]);
      expect(recipesOnly.total).toBe(2);

      const cookbooksOnly = await listLibrary(viewer(ownerId), { ...base, type: "cookbooks" });

      expect(kinds(cookbooksOnly.items)).toEqual(["cookbook", "cookbook"]);
      expect(cookbooksOnly.total).toBe(2);
    });
  });

  describe("search", () => {
    it("pins a matching cookbook above the ranked recipes", async () => {
      await seedMixedLibrary();
      await createTestRecipe(ownerId, { name: "Brunch pancakes" });

      const result = await listLibrary(viewer(ownerId), { ...base, search: "brunch" });

      expect(titles(result.items)).toEqual(["Brunch", "Brunch pancakes"]);
      expect(kinds(result.items)).toEqual(["cookbook", "recipe"]);
    });

    it("matches a cookbook on its title alone", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });

      await addRecipeToCookbook(
        cookbook.id,
        (await createTestRecipe(ownerId, { name: "Aubergine bake" })).id
      );

      // The member's name is not the cookbook's business (ADR-0026).
      const byMember = await listLibrary(viewer(ownerId), { ...base, search: "aubergine" });

      expect(kinds(byMember.items)).toEqual(["recipe"]);
    });

    it("removes cookbooks from search when Title is unticked", async () => {
      await createCookbook({ userId: ownerId, title: "Brunch" });
      await createTestRecipe(ownerId, {
        name: "Something else",
        description: "a brunch classic",
      });

      const result = await listLibrary(viewer(ownerId), {
        ...base,
        search: "brunch",
        searchFields: ["description"],
      });

      expect(kinds(result.items)).toEqual(["recipe"]);
      expect(result.total).toBe(1);
    });
  });

  describe("recipe-only filters", () => {
    it("restricts the results to recipes", async () => {
      await seedMixedLibrary();
      const rated = await createTestRecipe(ownerId, { name: "Rated" });

      await getTestDb()
        .insert(recipeRatings)
        .values({ recipeId: rated.id, userId: ownerId, rating: 5 });

      for (const params of [
        { minRating: 4 },
        { maxCookingTime: 60 },
        { categories: ["Dinner"] as const },
        { tags: ["vegetarian"] },
        { favoritesOnly: true },
      ]) {
        const result = await listLibrary(viewer(ownerId), { ...base, ...params });

        expect(
          result.items.every((item) => item.kind === "recipe"),
          JSON.stringify(params)
        ).toBe(true);
      }
    });

    it("keeps the rating filter pageable by applying it in SQL", async () => {
      const rated = await createTestRecipe(ownerId, { name: "Rated" });
      const unrated = await createTestRecipe(ownerId, { name: "Unrated" });

      await getTestDb()
        .insert(recipeRatings)
        .values({ recipeId: rated.id, userId: ownerId, rating: 5 });

      const result = await listLibrary(viewer(ownerId), { ...base, minRating: 4 });

      expect(result.items.map((item) => (item.kind === "recipe" ? item.recipe.id : ""))).toEqual([
        rated.id,
      ]);
      // The total is the filtered total, so the next page is right.
      expect(result.total).toBe(1);
      expect(
        result.items.map((item) => (item.kind === "recipe" ? item.recipe.id : ""))
      ).not.toContain(unrated.id);
    });
  });

  describe("the view policy", () => {
    it("filters both kinds", async () => {
      await setPolicy("owner");
      await createCookbook({ userId: ownerId, title: "Theirs" });
      await createTestRecipe(ownerId, { name: "Also theirs" });

      const seenByStranger = await listLibrary(viewer(strangerId), base);

      expect(seenByStranger.items).toHaveLength(0);
      expect(seenByStranger.total).toBe(0);

      await setPolicy("everyone");

      const seenByEveryone = await listLibrary(viewer(strangerId), base);

      expect(seenByEveryone.total).toBeGreaterThanOrEqual(2);
    });

    it("shows an Orphaned cookbook under every policy", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Left behind" });

      await getTestDb()
        .update(cookbooksTable)
        .set({ userId: null })
        .where(eq(cookbooksTable.id, cookbook.id));

      for (const level of ["everyone", "household", "owner"] as const) {
        await setPolicy(level);

        const result = await listLibrary(viewer(strangerId), { ...base, type: "cookbooks" });

        expect(titles(result.items), level).toContain("Left behind");
      }
    });
  });
});
