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
import { deleteRecipeById, listRecipes } from "@norish/db/repositories/recipes";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import {
  cookbooks as cookbooksTable,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeRatings,
  recipeTags,
  steps as stepsTable,
  tags as tagsTable,
} from "@norish/db/schema";

import { resolveIngredients } from "../../../../../shared-server/src/ingredients/resolver";
import {
  createTestRecipe,
  createTestRecipeStep,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
} from "../../../helpers/db-test-helpers";
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

    // Every row's time is set here: recipes would take this machine's clock and cookbooks the
    // database's, and a skew between the two reorders the date sorts.
    const minute = (n: number) => new Date(Date.UTC(2026, 0, 1, 12, n));
    const alphaRecipe = await createTestRecipe(ownerId, {
      name: "Aubergine bake",
      createdAt: minute(0),
    });
    const bravoCookbook = await createCookbook({ userId: ownerId, title: "Brunch" });
    const charlieRecipe = await createTestRecipe(ownerId, {
      name: "Carrot soup",
      createdAt: minute(2),
    });
    const deltaCookbook = await createCookbook({ userId: ownerId, title: "Dinner party" });

    for (const [cookbook, at] of [
      [bravoCookbook, minute(1)],
      [deltaCookbook, minute(3)],
    ] as const) {
      await getTestDb()
        .update(cookbooksTable)
        .set({ createdAt: at })
        .where(eq(cookbooksTable.id, cookbook.id));
    }

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

    it("treats text with no search terms as no text", async () => {
      const { alphaRecipe } = await seedMixedLibrary();

      await createCookbook({ userId: ownerId, title: "C^ookbook" });
      await getTestDb()
        .update(cookbooksTable)
        .set({ createdAt: new Date(Date.UTC(2026, 0, 1, 12, 4)) })
        .where(eq(cookbooksTable.title, "C^ookbook"));

      for (const sortMode of ["titleDesc", "none"] as const) {
        const plain = await listLibrary(viewer(ownerId), { ...base, sortMode });

        for (const search of ["  ", "^", "^ !"]) {
          expect(await listLibrary(viewer(ownerId), { ...base, sortMode, search })).toEqual(plain);
        }
      }

      const recipesOf = (search?: string) =>
        listRecipes(viewer(ownerId), 50, 0, search, ["title"], undefined, "OR", "titleDesc");
      const plainRecipes = await recipesOf();

      expect(plainRecipes.recipes.map((recipe) => recipe.id)).toContain(alphaRecipe.id);
      for (const search of ["  ", "^", "^ !"]) {
        expect(await recipesOf(search)).toEqual(plainRecipes);
      }
    });
  });

  describe("an explicit sort while searching", () => {
    // Rank: "Soup soup" first (two hits), then "Zesty soup", "Soup" and "Brisk soup" tied.
    // Each flagged sort disagrees with rank-first, and the tie shows the tie-break.
    async function seedRanked() {
      await deleteRecipeById(baseRecipeId);

      const minute = (n: number) => new Date(Date.UTC(2026, 0, 1, 12, n));

      for (const [name, at] of [
        ["Zesty soup", 0],
        ["Soup soup", 1],
        ["Soup", 2],
        ["Brisk soup", 3],
      ] as const) {
        await createTestRecipe(ownerId, { name, createdAt: minute(at) });
      }
    }

    const order = async (params: Partial<LibraryListParams>) =>
      titles((await listLibrary(viewer(ownerId), { ...base, search: "soup", ...params })).items);

    it("orders by rank without the flag, the chosen sort only breaking ties", async () => {
      await seedRanked();

      const expected = {
        none: ["Soup soup", "Brisk soup", "Soup", "Zesty soup"],
        dateDesc: ["Soup soup", "Brisk soup", "Soup", "Zesty soup"],
        dateAsc: ["Soup soup", "Zesty soup", "Soup", "Brisk soup"],
        titleAsc: ["Soup soup", "Brisk soup", "Soup", "Zesty soup"],
        titleDesc: ["Soup soup", "Zesty soup", "Soup", "Brisk soup"],
      } as const;

      for (const [sortMode, titlesInOrder] of Object.entries(expected)) {
        expect(await order({ sortMode: sortMode as keyof typeof expected })).toEqual(titlesInOrder);
      }
    });

    it("follows rank for none with the flag", async () => {
      await seedRanked();

      expect(await order({ sortMode: "none", sortBeatsRank: true })).toEqual([
        "Soup soup",
        "Brisk soup",
        "Soup",
        "Zesty soup",
      ]);
    });

    it.each([
      ["dateDesc", ["Brisk soup", "Soup", "Soup soup", "Zesty soup"]],
      ["dateAsc", ["Zesty soup", "Soup soup", "Soup", "Brisk soup"]],
      ["titleAsc", ["Brisk soup", "Soup", "Soup soup", "Zesty soup"]],
      ["titleDesc", ["Zesty soup", "Soup soup", "Soup", "Brisk soup"]],
    ] as const)("follows %s over rank with the flag", async (sortMode, expected) => {
      await seedRanked();

      expect(await order({ sortMode, sortBeatsRank: true })).toEqual(expected);
    });

    it("keeps newest first for none without text", async () => {
      await seedRanked();

      expect(await order({ search: undefined, sortMode: "none", sortBeatsRank: true })).toEqual([
        "Brisk soup",
        "Soup",
        "Soup soup",
        "Zesty soup",
      ]);
    });

    it("still orders a Pantry-only list by coverage first", async () => {
      await deleteRecipeById(baseRecipeId);

      const names = ["onion", "salt"];
      const resolved = await resolveIngredients(names, { userId: ownerId });

      await getTestDb()
        .insert(pantryIngredients)
        .values([
          {
            userId: ownerId,
            ingredientId: resolved[0]!.ingredientId,
            ingredientAliasId: resolved[0]!.aliasId,
          },
        ]);

      for (const [name, foods] of [
        ["Aaa half", [0, 1]],
        ["Zzz full", [0]],
      ] as const) {
        const made = await createTestRecipe(ownerId, { name });

        for (const i of foods) {
          await insertTestRecipeLine({ recipeId: made.id, name: names[i]! }, [
            resolved[i]!.aliasId,
          ]);
        }
      }

      for (const sortBeatsRank of [false, true]) {
        const result = await listLibrary(viewer(ownerId), {
          ...base,
          pantryOnly: true,
          sortMode: "titleAsc",
          sortBeatsRank,
        });

        expect(titles(result.items)).toEqual(["Zzz full", "Aaa half"]);
      }
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
        { pantryOnly: true },
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

  describe("the pantry filter", () => {
    it("keeps the recipes the household's Pantry covers a line of, most complete first", async () => {
      const housemate = await createTestUser({ name: "Housemate" });
      const names = ["onion", "red onion", "olive oil", "butter", "salt", "garlic", "black garlic"];
      const resolved = await resolveIngredients(names, { userId: ownerId });
      const food = Object.fromEntries(names.map((name, i) => [name, resolved[i]!]));
      const db = getTestDb();

      for (const [child, parent] of [
        ["red onion", "onion"],
        ["black garlic", "garlic"],
      ] as const) {
        await db
          .update(ingredients)
          .set({ parentId: food[parent]!.ingredientId })
          .where(eq(ingredients.id, food[child]!.ingredientId));
      }

      // A housemate keeps them: the Pantry is the household's.
      await db.insert(pantryIngredients).values(
        ["red onion", "olive oil", "garlic"].map((name) => ({
          userId: housemate.id,
          ingredientId: food[name]!.ingredientId,
          ingredientAliasId: food[name]!.aliasId,
        }))
      );

      async function recipe(name: string, lines: Array<[string[], "together" | "alternatives"?]>) {
        const made = await createTestRecipe(ownerId, { name });

        await insertTestRecipeLine({ recipeId: made.id, name: "# For the pan" });

        for (const [foods, joined] of lines) {
          await insertTestRecipeLine(
            { recipeId: made.id, name: foods.join(" or "), joined },
            foods.map((name) => food[name]!.aliasId)
          );
        }
      }

      // Red onion covers onion; a line of alternatives needs any one of them.
      await recipe("Covered", [[["onion"]], [["butter", "olive oil"], "alternatives"]]);
      await recipe("Missing salt", [[["onion"]], [["salt"]]]);
      await recipe("Needs both", [[["olive oil", "salt"], "together"]]);
      // Garlic never covers a kind of it.
      await recipe("Wrong kind", [[["black garlic"]]]);
      await recipe("Names no food", []);

      const household = viewer(ownerId, [ownerId, housemate.id]);
      const result = await listLibrary(household, { ...base, pantryOnly: true });
      const coverage = result.items.map((item) =>
        item.kind === "recipe" ? [item.recipe.name, item.recipe.pantryCoverage] : []
      );

      // Nothing at home, or no food named, leaves a recipe out.
      expect(coverage).toEqual([
        ["Covered", 1],
        ["Missing salt", 0.5],
      ]);
      expect(result.total).toBe(2);

      // A cookbook's page orders its members the same way.
      const members = await listRecipes(
        household,
        50,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { pantryOnly: true }
      );

      expect(members.recipes.map((recipe) => [recipe.name, recipe.pantryCoverage])).toEqual(
        coverage
      );
    });
  });

  describe("the ingredient filter", () => {
    const FOODS = ["onion", "red onion", "pearl onion", "garlic", "chicken"] as const;

    /** Onion > red onion > pearl onion, garlic and chicken apart; one recipe per case. */
    async function seedFoods() {
      await deleteRecipeById(baseRecipeId);

      const resolved = await resolveIngredients([...FOODS], { userId: ownerId });
      const food = Object.fromEntries(FOODS.map((name, i) => [name, resolved[i]!]));
      const db = getTestDb();

      for (const [child, parent] of [
        ["red onion", "onion"],
        ["pearl onion", "red onion"],
      ] as const) {
        await db
          .update(ingredients)
          .set({ parentId: food[parent]!.ingredientId })
          .where(eq(ingredients.id, food[child]!.ingredientId));
      }

      async function recipe(name: string, foods: (typeof FOODS)[number][], aliasIds?: string[]) {
        const made = await createTestRecipe(ownerId, { name });

        for (const [i, line] of foods.entries()) {
          await insertTestRecipeLine({ recipeId: made.id, name: line, order: String(i) }, [
            aliasIds?.[i] ?? food[line]!.aliasId,
          ]);
        }

        return made;
      }

      return { food, recipe };
    }

    async function tag(recipeIds: string[], name: string) {
      const [row] = await getTestDb().insert(tagsTable).values({ name }).returning();

      await getTestDb()
        .insert(recipeTags)
        .values(recipeIds.map((recipeId) => ({ recipeId, tagId: row!.id, order: 0 })));
    }

    const named = async (params: Partial<LibraryListParams>) =>
      titles((await listLibrary(viewer(ownerId), { limit: 50, type: "recipes", ...params })).items)
        .slice()
        .sort();

    it("keeps recipes naming the Ingredient or any descendant, never an ancestor", async () => {
      const { food, recipe } = await seedFoods();

      await recipe("Onion soup", ["onion"]);
      await recipe("Red salad", ["red onion"]);
      await recipe("Pearl stew", ["pearl onion"]);
      await recipe("Garlic bread", ["garlic"]);

      expect(await named({ ingredientIds: [food.onion!.ingredientId] })).toEqual([
        "Onion soup",
        "Pearl stew",
        "Red salad",
      ]);
      expect(await named({ ingredientIds: [food["red onion"]!.ingredientId] })).toEqual([
        "Pearl stew",
        "Red salad",
      ]);
      expect(await named({ ingredientIds: [food["pearl onion"]!.ingredientId] })).toEqual([
        "Pearl stew",
      ]);
    });

    it("finds a line reached through an alias of the Ingredient", async () => {
      const { food, recipe } = await seedFoods();
      const [alias] = await getTestDb()
        .insert(ingredientAliases)
        .values({
          text: "spring onion",
          fold: "spring onion",
          ingredientId: food.onion!.ingredientId,
        })
        .returning();

      await recipe("Spring bowl", ["onion"], [alias!.id]);

      expect(await named({ ingredientIds: [food.onion!.ingredientId] })).toEqual(["Spring bowl"]);
    });

    it("returns none for an Ingredient no recipe names, and drops cookbooks", async () => {
      const { food, recipe } = await seedFoods();

      await recipe("Onion soup", ["onion"]);
      await createCookbook({ userId: ownerId, title: "Chicken book" });

      const result = await listLibrary(viewer(ownerId), {
        limit: 50,
        ingredientIds: [food.chicken!.ingredientId],
      });

      expect(result).toEqual({ items: [], total: 0 });
    });

    it("applies All and Any to tags and Ingredients together", async () => {
      const { food, recipe } = await seedFoods();
      await recipe("Onion soup", ["onion"]);
      const redSalad = await recipe("Red salad", ["red onion"]);
      const garlicBread = await recipe("Garlic bread", ["garlic"]);
      await recipe("Onion and garlic", ["onion", "garlic"]);

      await tag([redSalad.id, garlicBread.id], "vegan");

      const onion = food.onion!.ingredientId;
      const garlic = food.garlic!.ingredientId;

      expect(await named({ tags: ["vegan"], ingredientIds: [onion], filterMode: "AND" })).toEqual([
        "Red salad",
      ]);
      expect(await named({ tags: ["vegan"], ingredientIds: [onion], filterMode: "OR" })).toEqual([
        "Garlic bread",
        "Onion and garlic",
        "Onion soup",
        "Red salad",
      ]);
      expect(await named({ ingredientIds: [onion, garlic], filterMode: "AND" })).toEqual([
        "Onion and garlic",
      ]);
      expect(await named({ ingredientIds: [onion, garlic], filterMode: "OR" })).toEqual([
        "Garlic bread",
        "Onion and garlic",
        "Onion soup",
        "Red salad",
      ]);
    });

    it("answers a cycle in the parents instead of looping", async () => {
      const { food, recipe } = await seedFoods();

      await recipe("Pearl stew", ["pearl onion"]);
      await getTestDb()
        .update(ingredients)
        .set({ parentId: food["pearl onion"]!.ingredientId })
        .where(eq(ingredients.id, food.onion!.ingredientId));

      expect(await named({ ingredientIds: [food.onion!.ingredientId] })).toEqual(["Pearl stew"]);
    });

    it("says which line satisfied the filter when there is no text", async () => {
      const { food } = await seedFoods();
      const made = await createTestRecipe(ownerId, { name: "Pearl stew" });

      await insertTestRecipeLine({ recipeId: made.id, name: "# For the stew", order: "0" });
      await insertTestRecipeLine(
        { recipeId: made.id, name: "salt", amount: "1", unit: "tsp", order: "1" },
        [food.garlic!.aliasId]
      );
      await insertTestRecipeLine(
        { recipeId: made.id, name: "pearl onions, peeled", amount: "4", unit: "g", order: "2" },
        [food["pearl onion"]!.aliasId]
      );

      const match = async (ids: string[], params: Partial<LibraryListParams> = {}) =>
        (
          await listLibrary(viewer(ownerId), {
            limit: 50,
            withMatch: true,
            ingredientIds: ids,
            ...params,
          })
        ).items.map((item) => ("match" in item ? item.match : undefined));

      // The line of a descendant, as written: the garlic line is not what the onion filter asked.
      expect(await match([food.onion!.ingredientId])).toEqual([
        { field: "ingredients", amount: 4, unit: "g", name: "pearl onions, peeled" },
      ]);
      expect(await match([food.garlic!.ingredientId, food.onion!.ingredientId])).toEqual([
        { field: "ingredients", amount: 1, unit: "tsp", name: "salt" },
      ]);
      // The text's own match wins when there is text.
      expect(await match([food.onion!.ingredientId], { search: "stew" })).toEqual([
        { field: "title" },
      ]);
      expect(await match([food.onion!.ingredientId], { withMatch: false })).toEqual([undefined]);
      // Text with no search terms is no text: the Ingredient's line still shows.
      for (const search of ["  ", "^"]) {
        expect(await match([food.onion!.ingredientId], { search })).toEqual([
          { field: "ingredients", amount: 4, unit: "g", name: "pearl onions, peeled" },
        ]);
      }
    });

    it("changes nothing without ids", async () => {
      const { recipe } = await seedFoods();

      await recipe("Onion soup", ["onion"]);

      const plain = await listLibrary(viewer(ownerId), { limit: 50 });

      expect(await listLibrary(viewer(ownerId), { limit: 50, ingredientIds: [] })).toEqual(plain);
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

  describe("why a result matched", () => {
    const ALL = ["title", "tags", "ingredients", "description", "steps"] as const;

    /** One recipe with a hit for "basil" in each of the five fields, or in the ones named. */
    async function seedBasil(hits: readonly (typeof ALL)[number][]) {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, {
        name: hits.includes("title") ? "Basil pesto" : "Green sauce",
        description: hits.includes("description")
          ? "A bright sauce made with fresh basil leaves and pine nuts for pasta"
          : "A bright sauce",
      });

      if (hits.includes("tags")) {
        const [tag] = await getTestDb()
          .insert(tagsTable)
          .values({ name: "basil" })
          .onConflictDoNothing()
          .returning();

        await getTestDb()
          .insert(recipeTags)
          .values({ recipeId: recipe.id, tagId: tag!.id, order: 0 });
      }

      if (hits.includes("ingredients")) {
        await insertTestRecipeLine({ recipeId: recipe.id, name: "fresh basil leaves", order: "0" });
      }

      await createTestRecipeStep(recipe.id, "metric", { step: "Chop the onion", order: "0" });
      await createTestRecipeStep(recipe.id, "metric", {
        step: hits.includes("steps") ? "Pound the basil with salt" : "Stir well",
        order: "1",
      });

      return recipe;
    }

    const matchOf = async (params: Partial<LibraryListParams>) => {
      const result = await listLibrary(viewer(ownerId), {
        ...base,
        search: "basil",
        withMatch: true,
        ...params,
      });
      const [item] = result.items;

      return item?.kind === "recipe" ? item.match : undefined;
    };

    it("reports the title without text", async () => {
      await seedBasil(["title"]);

      expect(await matchOf({ searchFields: [...ALL] })).toEqual({ field: "title" });
    });

    it("reports the tag", async () => {
      await seedBasil(["tags"]);

      expect(await matchOf({ searchFields: [...ALL] })).toEqual({ field: "tags", tag: "basil" });
    });

    it("reports the ingredient line as written", async () => {
      await seedBasil(["ingredients"]);

      expect(await matchOf({ searchFields: [...ALL] })).toEqual({
        field: "ingredients",
        amount: null,
        unit: null,
        name: "fresh basil leaves",
      });
    });

    it("reports a snippet of the description around the hit", async () => {
      await seedBasil(["description"]);

      const match = await matchOf({ searchFields: [...ALL] });

      expect(match).toEqual({
        field: "description",
        snippet: "bright sauce made with fresh basil leaves and pine nuts for pasta",
      });
    });

    it("cuts a long description to a short snippet around the hit", async () => {
      await deleteRecipeById(baseRecipeId);
      await createTestRecipe(ownerId, {
        name: "Green sauce",
        description: `${"Once upon a time there was a very long introduction. ".repeat(8)}Then add the basil and stir.`,
      });

      const match = await matchOf({ searchFields: ["description"] });

      expect(match?.field).toBe("description");

      const snippet = match && "snippet" in match ? match.snippet : "";

      expect(snippet).toContain("basil");
      expect(snippet.split(/\s+/).length).toBeLessThanOrEqual(15);
      expect(snippet).not.toMatch(/[<>\uE000\uE001]/);
    });

    it("reports the step with its number", async () => {
      await seedBasil(["steps"]);

      const match = await matchOf({ searchFields: [...ALL] });

      expect(match).toEqual({ field: "steps", number: 2, snippet: "Pound the basil with salt" });
    });

    it("prefers title, then tag, ingredient, description, step", async () => {
      await seedBasil([...ALL]);

      const order: [readonly (typeof ALL)[number][], string][] = [
        [ALL, "title"],
        [ALL.slice(1), "tags"],
        [ALL.slice(2), "ingredients"],
        [ALL.slice(3), "description"],
        [ALL.slice(4), "steps"],
      ];

      for (const [fields, expected] of order) {
        expect((await matchOf({ searchFields: [...fields] }))?.field).toBe(expected);
      }
    });

    it("ignores a hit outside the Search Scope and reports the next one in it", async () => {
      await seedBasil(["title", "ingredients", "steps"]);

      expect((await matchOf({ searchFields: ["ingredients", "steps"] }))?.field).toBe(
        "ingredients"
      );
      expect((await matchOf({ searchFields: ["description", "steps"] }))?.field).toBe("steps");
    });

    it("gives every recipe the search returns a match, matching by prefix too", async () => {
      await seedBasil(["ingredients"]);

      const result = await listLibrary(viewer(ownerId), {
        ...base,
        search: "bas",
        searchFields: [...ALL],
        withMatch: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items.every((item) => item.kind === "recipe" && item.match)).toBe(true);
    });

    it("takes the snippet from the step that matched, not its neighbours", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      for (const [order, step] of [
        ["0", "Wash the leaves and dry them well on a clean towel before chopping anything"],
        [
          "1",
          `${"Heat the pan slowly and wait until it is properly hot. ".repeat(4)}Add the basil.`,
        ],
        ["2", "Season with pepper and serve warm with fresh bread and a little olive oil"],
      ] as const) {
        await createTestRecipeStep(recipe.id, "metric", { step, order });
      }

      const match = await matchOf({ searchFields: ["steps"] });

      expect(match).toMatchObject({ field: "steps", number: 2 });

      const snippet = match && "snippet" in match ? match.snippet : "";

      expect(snippet).toContain("basil");
      expect(snippet).not.toMatch(/towel|pepper/);
      expect(snippet.split(/\s+/).length).toBeLessThanOrEqual(15);
    });

    it("reports a matching step heading as a plain snippet, without number or #", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await createTestRecipeStep(recipe.id, "metric", { step: "# The basil", order: "0" });
      await createTestRecipeStep(recipe.id, "metric", { step: "Stir well", order: "1" });

      const match = await matchOf({ searchFields: ["steps"] });

      expect(match).toEqual({ field: "steps", snippet: expect.stringContaining("basil") });
      expect(match).not.toHaveProperty("number");
      expect(JSON.stringify(match)).not.toContain("#");
    });

    it("prefers a step over a heading that also matches", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await createTestRecipeStep(recipe.id, "metric", { step: "# The basil", order: "0" });
      await createTestRecipeStep(recipe.id, "metric", { step: "Pound the basil", order: "1" });

      expect(await matchOf({ searchFields: ["steps"] })).toEqual({
        field: "steps",
        number: 1,
        snippet: "Pound the basil",
      });
    });

    it("reports the ingredient line as written, with its amount and unit", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await insertTestRecipeLine({
        recipeId: recipe.id,
        name: "basil leaves",
        amount: "4",
        unit: "g",
        order: "0",
      });

      expect(await matchOf({ searchFields: ["ingredients"] })).toEqual({
        field: "ingredients",
        amount: 4,
        unit: "g",
        name: "basil leaves",
      });
    });

    it("skips a heading line and takes the next ingredient that matches", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await insertTestRecipeLine({ recipeId: recipe.id, name: "# For the basil", order: "0" });
      await insertTestRecipeLine({ recipeId: recipe.id, name: "basil leaves", order: "1" });

      expect(await matchOf({ searchFields: ["ingredients"] })).toMatchObject({
        field: "ingredients",
        name: "basil leaves",
      });
    });

    it("takes an ingredient line from the recipe's own system, once", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await insertTestRecipeLine({
        recipeId: recipe.id,
        name: "basil leaves",
        amount: "1",
        unit: "cup",
        systemUsed: "us",
        order: "0",
      });
      await insertTestRecipeLine({
        recipeId: recipe.id,
        name: "basil leaves",
        amount: "240",
        unit: "ml",
        systemUsed: "metric",
        order: "1",
      });

      expect(await matchOf({ searchFields: ["ingredients"] })).toMatchObject({
        amount: 240,
        unit: "ml",
      });
    });

    it("numbers the step as the recipe page does: headings take no number", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      for (const [order, step] of [
        ["0", "# Prepare"],
        ["1", "Chop the onion"],
        ["2", "# Cook"],
        ["3", "Pound the basil with salt"],
      ] as const) {
        await createTestRecipeStep(recipe.id, "metric", { step, order });
      }

      expect(await matchOf({ searchFields: ["steps"] })).toMatchObject({
        field: "steps",
        number: 2,
      });
    });

    it("numbers a step within its own measurement system", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      for (const [system, order, step] of [
        ["us", "0", "Preheat the pan"],
        ["us", "1", "Chop the onion"],
        ["us", "2", "Pound the basil with salt"],
        ["metric", "3", "Chop the onion"],
        ["metric", "4", "Pound the basil with salt"],
      ] as const) {
        await createTestRecipeStep(recipe.id, system, { step, order });
      }

      expect(await matchOf({ searchFields: ["steps"] })).toMatchObject({
        field: "steps",
        number: 2,
      });
    });

    it("gives a recipe whose phrase spans two tags a match", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      for (const [order, name] of [
        [0, "chicken"],
        [1, "rice"],
      ] as const) {
        const [tag] = await getTestDb()
          .insert(tagsTable)
          .values({ name })
          .onConflictDoNothing()
          .returning();

        await getTestDb().insert(recipeTags).values({ recipeId: recipe.id, tagId: tag!.id, order });
      }

      const result = await listLibrary(viewer(ownerId), {
        ...base,
        search: "chicken,rice",
        searchFields: ["tags"],
        withMatch: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ match: { field: "tags", tag: "chicken" } });
    });

    it("reports a heading-only ingredient hit as the heading's text", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await insertTestRecipeLine({
        recipeId: recipe.id,
        name: "## For the basil",
        amount: "1",
        unit: "g",
        order: "0",
      });
      await insertTestRecipeLine({ recipeId: recipe.id, name: "olive oil", order: "1" });

      expect(await matchOf({ searchFields: ["ingredients"] })).toEqual({
        field: "ingredients",
        amount: null,
        unit: null,
        name: "For the basil",
      });
    });

    it("reads a heading behind a non-breaking space as the page does", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await createTestRecipeStep(recipe.id, "metric", { step: "\u00a0# Prepare", order: "0" });
      await createTestRecipeStep(recipe.id, "metric", { step: "Pound the basil", order: "1" });
      await insertTestRecipeLine({ recipeId: recipe.id, name: "\u00a0# Basil", order: "0" });
      await insertTestRecipeLine({ recipeId: recipe.id, name: "basil leaves", order: "1" });

      expect(await matchOf({ searchFields: ["steps"] })).toMatchObject({ number: 1 });
      expect(await matchOf({ searchFields: ["ingredients"] })).toMatchObject({
        name: "basil leaves",
      });
    });

    it("orders a step without an order first, as the page reads it as 0", async () => {
      await deleteRecipeById(baseRecipeId);

      const recipe = await createTestRecipe(ownerId, { name: "Green sauce" });

      await createTestRecipeStep(recipe.id, "metric", { step: "Chop the onion", order: "1" });
      const unordered = await createTestRecipeStep(recipe.id, "metric", {
        step: "Pound the basil",
      });

      await getTestDb()
        .update(stepsTable)
        .set({ order: null })
        .where(eq(stepsTable.id, unordered!.id));

      expect(await matchOf({ searchFields: ["steps"] })).toMatchObject({ number: 1 });
    });

    it("ignores a query term the parser drops", async () => {
      await seedBasil(["title"]);

      expect(await matchOf({ search: "basil ^", searchFields: [...ALL] })).toEqual({
        field: "title",
      });
    });

    it("carries no match without text, without the flag, or on a cookbook", async () => {
      await seedBasil(["title"]);
      await createCookbook({ userId: ownerId, title: "Basil book" });

      const noText = await listLibrary(viewer(ownerId), { ...base, withMatch: true });
      const noFlag = await listLibrary(viewer(ownerId), { ...base, search: "basil" });
      const both = await listLibrary(viewer(ownerId), {
        ...base,
        search: "basil",
        withMatch: true,
      });

      for (const result of [noText, noFlag]) {
        expect(result.items.some((item) => "match" in item)).toBe(false);
      }

      expect(both.items.map((item) => [item.kind, "match" in item])).toEqual([
        ["cookbook", false],
        ["recipe", true],
      ]);
    });
  });
});
