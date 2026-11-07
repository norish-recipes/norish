// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  attachCategoriesToRecipeByInputTx,
  listCategoryNamesForUsers,
} from "@norish/db/repositories/categories";
import {
  getRandomRecipeCandidates,
  getRecipeFull,
  listRecipes,
} from "@norish/db/repositories/recipes";
import { categories } from "@norish/db/schema";

import { createTestRecipe, createTestUser } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_categories");

async function attach(recipeId: string, names: string[]) {
  await db.transaction((tx) => attachCategoriesToRecipeByInputTx(tx, recipeId, names));
}

async function allCategoryNames(): Promise<string[]> {
  const rows = await db.select({ name: categories.name }).from(categories);

  return rows.map((row) => row.name).sort();
}

describe("Categories Repository", () => {
  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("attaches the built-in for a synonym in another language and for another casing", async () => {
    const user = await createTestUser();
    const dutch = await createTestRecipe(user.id, { name: "Pannenkoeken" });
    const shouting = await createTestRecipe(user.id, { name: "Eggs" });

    await attach(dutch.id, ["ontbijt"]);
    await attach(shouting.id, ["BREAKFAST"]);

    expect((await getRecipeFull(dutch.id))?.categories).toEqual(["Breakfast"]);
    expect((await getRecipeFull(shouting.id))?.categories).toEqual(["Breakfast"]);
    expect(await allCategoryNames()).toEqual(["Breakfast", "Dinner", "Lunch", "Snack"]);
  });

  it("reuses an existing row whatever the casing, keeping the first spelling", async () => {
    const user = await createTestUser();
    const first = await createTestRecipe(user.id, { name: "Mojito" });
    const second = await createTestRecipe(user.id, { name: "Negroni" });

    await attach(first.id, ["Cocktails"]);
    await attach(second.id, ["  cocktails "]);

    expect((await getRecipeFull(second.id))?.categories).toEqual(["Cocktails"]);
  });

  it("removes an unused Category but spares the built-ins", async () => {
    const user = await createTestUser();
    const recipe = await createTestRecipe(user.id, { name: "Mojito" });

    await attach(recipe.id, ["Cocktails", "Dinner"]);
    await attach(recipe.id, []);

    expect((await getRecipeFull(recipe.id))?.categories).toEqual([]);
    expect(await allCategoryNames()).toEqual(["Breakfast", "Dinner", "Lunch", "Snack"]);
  });

  it("lists the built-ins plus the household's own Categories, never another household's", async () => {
    const me = await createTestUser();
    const partner = await createTestUser();
    const stranger = await createTestUser();

    await attach((await createTestRecipe(partner.id, { name: "Tiramisu" })).id, ["Puddings"]);
    await attach((await createTestRecipe(stranger.id, { name: "Mojito" })).id, ["Cocktails"]);

    expect(await listCategoryNamesForUsers([me.id, partner.id])).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snack",
      "Puddings",
    ]);
  });

  it("filters the recipe list and the random picker by Category", async () => {
    const user = await createTestUser();
    const dinner = await createTestRecipe(user.id, { name: "Stew" });
    const drink = await createTestRecipe(user.id, { name: "Mojito" });
    const viewer = { userId: user.id, householdUserIds: null, isServerAdmin: false };

    await attach(dinner.id, ["Dinner"]);
    await attach(drink.id, ["Cocktails"]);

    const listed = await listRecipes(
      viewer,
      50,
      0,
      undefined,
      undefined,
      undefined,
      "OR",
      "dateDesc",
      undefined,
      undefined,
      ["cocktails"]
    );
    const candidates = await getRandomRecipeCandidates(viewer, "Dinner");

    expect(listed.recipes.map((r) => [r.name, r.categories])).toEqual([["Mojito", ["Cocktails"]]]);
    expect(candidates.map((r) => [r.name, r.categories])).toEqual([["Stew", ["Dinner"]]]);
  });
});
