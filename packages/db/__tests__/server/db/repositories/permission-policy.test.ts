// @vitest-environment node
/**
 * The Permission Policy's one condition against real Postgres, with two households under both
 * view levels: every reader of recipes and cookbooks applies it to the row's household, and a
 * policy change hides or shows what reading across households made, never changing it.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  addRecipeToCookbook,
  createCookbook,
  getCookbookForViewer,
  listCookbookMemberIds,
  listCookbooks,
  listEditableCookbooks,
} from "@norish/db/repositories/cookbooks";
import {
  getFavoriteRecipesWithVersions,
  getFavoritesByRecipeIds,
  setFavorite,
} from "@norish/db/repositories/favorites";
import { getRecipeInfoForGroceries } from "@norish/db/repositories/groceries";
import { listLibrary } from "@norish/db/repositories/library";
import {
  createPlannedItem,
  listPlannedItemsByHouseholdAndDateRange,
} from "@norish/db/repositories/planned-items";
import {
  findExistingRecipe,
  getRandomRecipeCandidates,
  getRecipeHouseholdIds,
  listRecipes,
  listVisibleRecipeIds,
  recipeExistsByUrlForPolicy,
  searchRecipesByName,
} from "@norish/db/repositories/recipes";
import { setConfig } from "@norish/db/repositories/server-config";

import {
  addTestGrocery,
  createTestRecipe,
  createTestUser,
  insertTestRecipeLine,
  joinTestHousehold,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

type Level = "everyone" | "household";

const viewer = (userId: string): RecipeListContext => ({
  userId,
  householdId: testHouseholdOf(userId),
});

async function setView(view: Level) {
  await setConfig(
    ServerConfigKeys.RECIPE_PERMISSION_POLICY,
    { view, edit: "household", delete: "household" },
    null,
    false
  );
}

describe("the Permission Policy over two households", () => {
  const testBase = new RepositoryTestBase("test_permission_policy");
  let ann: string;
  let alex: string;
  let bob: string;
  let admin: string;
  let soup: string;
  let stew: string;
  let annsCookbook: string;

  // Only the two fixture recipes, whatever else the base seeds.
  const ours = (ids: string[]) => ids.filter((id) => id === soup || id === stew).sort();
  const listed = async (reader: string) =>
    ours((await listRecipes(viewer(reader), 50)).recipes.map((recipe) => recipe.id));

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    // Ann and Alex are household A; Bob, and a server admin, each a household of their own.
    ann = user.id;
    alex = (await createTestUser({ name: "Alex" })).id;
    bob = (await createTestUser({ name: "Bob" })).id;
    admin = (await createTestUser({ name: "Admin", isServerAdmin: true })).id;
    await joinTestHousehold(alex, ann);

    soup = (await createTestRecipe(ann, { name: "Soup", url: "https://a.example/soup" })).id;
    stew = (await createTestRecipe(bob, { name: "Stew", url: "https://b.example/stew" })).id;
    // Filed and favourited while reading across households was allowed.
    await setView("everyone");
    annsCookbook = (await createCookbook({ userId: ann, title: "Ann's" })).id;
    await addRecipeToCookbook(annsCookbook, soup);
    await addRecipeToCookbook(annsCookbook, stew);
    await setFavorite(ann, stew, true);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("keys every recipe to its Owner's household", async () => {
    const households = await getRecipeHouseholdIds([soup, stew]);

    expect(households.get(soup)).toBe(testHouseholdOf(ann));
    expect(households.get(stew)).toBe(testHouseholdOf(bob));
  });

  it("lists every household's recipes under view Everyone", async () => {
    expect(await listed(bob)).toEqual([soup, stew].sort());
    expect(await listed(admin)).toEqual([soup, stew].sort());
    expect(ours(await listVisibleRecipeIds(viewer(bob)))).toEqual([soup, stew].sort());
    expect((await searchRecipesByName(viewer(bob), "Soup")).map((r) => r.id)).toEqual([soup]);
    expect(
      (await recipeExistsByUrlForPolicy("https://a.example/soup", testHouseholdOf(bob), "everyone"))
        .exists
    ).toBe(true);
  });

  it("lists only the reader's household's recipes under view Household, an admin's included", async () => {
    await setView("household");

    expect(await listed(alex)).toEqual([soup]);
    expect(await listed(bob)).toEqual([stew]);
    expect(await listed(admin)).toEqual([]);
    expect(await searchRecipesByName(viewer(bob), "Soup")).toEqual([]);
    expect(ours((await getRandomRecipeCandidates(viewer(bob))).map((r) => r.id))).toEqual([stew]);
    expect(
      (
        await recipeExistsByUrlForPolicy(
          "https://a.example/soup",
          testHouseholdOf(bob),
          "household"
        )
      ).exists
    ).toBe(false);

    const library = await listLibrary(viewer(admin), { limit: 50 });

    expect(library.total).toBe(0);
  });

  it("shows a cookbook and its members by the same condition", async () => {
    await setView("household");

    expect((await listCookbooks(viewer(bob), { limit: 50 })).total).toBe(0);
    expect(await getCookbookForViewer(viewer(admin), annsCookbook)).toBeNull();
    expect((await getCookbookForViewer(viewer(alex), annsCookbook))?.memberCount).toBe(1);
    expect(
      (
        await listRecipes(
          viewer(alex),
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
          { cookbookId: annsCookbook }
        )
      ).recipes.map((r) => r.id)
    ).toEqual([soup]);
  });

  it("lets a housemate edit a cookbook, and nobody outside under edit Household", async () => {
    expect((await listEditableCookbooks(viewer(alex))).map((c) => c.id)).toEqual([annsCookbook]);
    expect(await listEditableCookbooks(viewer(bob))).toEqual([]);
    expect(await listEditableCookbooks(viewer(admin))).toEqual([]);
  });

  it("hides another household's favourite while the policy does, and shows it again after", async () => {
    const favourites = async () =>
      (
        await listRecipes(
          viewer(ann),
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
          { favoritesOnly: true }
        )
      ).recipes.map((r) => r.id);

    await setView("household");
    expect(await favourites()).toEqual([]);
    expect(await getFavoriteRecipesWithVersions(viewer(ann))).toEqual([]);
    expect(await getFavoritesByRecipeIds(viewer(ann), [stew])).toEqual(new Set());

    await setView("everyone");
    expect(await favourites()).toEqual([stew]);
    expect((await getFavoriteRecipesWithVersions(viewer(ann))).map((f) => f.recipeId)).toEqual([
      stew,
    ]);
    expect(await getFavoritesByRecipeIds(viewer(ann), [stew])).toEqual(new Set([stew]));
    expect((await listCookbookMemberIds(annsCookbook)).sort()).toEqual([soup, stew].sort());
  });

  it("shows a plan entry for a recipe out of view by its title alone, and all of it after", async () => {
    await createPlannedItem({
      householdId: testHouseholdOf(ann),
      userId: ann,
      date: "2026-01-05",
      slot: "Dinner",
      itemType: "recipe",
      recipeId: stew,
      title: null,
    });
    const plan = async () =>
      (
        await listPlannedItemsByHouseholdAndDateRange(
          testHouseholdOf(ann),
          "2026-01-01",
          "2026-01-31"
        )
      ).map(({ recipeId, recipeName, servings }) => ({ recipeId, recipeName, servings }));

    await setView("household");
    expect(await plan()).toEqual([{ recipeId: null, recipeName: "Stew", servings: null }]);

    await setView("everyone");
    expect(await plan()).toEqual([{ recipeId: stew, recipeName: "Stew", servings: 4 }]);
  });

  it("lists a grocery line from a recipe out of view with the hand-added ones, and back after", async () => {
    const line = await insertTestRecipeLine({ recipeId: stew, name: "beans" });

    await addTestGrocery(ann, { name: "beans", recipeIngredientId: line.id });

    await setView("household");
    expect(await getRecipeInfoForGroceries([line.id], testHouseholdOf(ann))).toEqual(new Map());

    await setView("everyone");
    expect(await getRecipeInfoForGroceries([line.id], testHouseholdOf(ann))).toEqual(
      new Map([[line.id, { recipeId: stew, recipeName: "Stew" }]])
    );
  });

  it("matches an import only within the importer's household", async () => {
    expect(await findExistingRecipe(testHouseholdOf(alex), "https://a.example/soup", "x")).toBe(
      soup
    );
    expect(
      await findExistingRecipe(testHouseholdOf(bob), "https://a.example/soup", "Soup")
    ).toBeNull();
  });
});
