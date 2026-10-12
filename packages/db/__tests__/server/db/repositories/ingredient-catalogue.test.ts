// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  listCatalogueAliasesOf,
  listCatalogueIngredients,
  listIngredientUses,
} from "@norish/db/repositories/ingredient-catalogue";
import * as schema from "@norish/db/schema";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";

import {
  createTestIngredient,
  createTestRecipe,
  createTestRecipeIngredients,
  createTestUser,
  getTestDb,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

/**
 * The catalogue search as the Ingredients page runs it: a text contained in,
 * or exactly, the name, a translation or the parent of an Ingredient.
 */
describe("listCatalogueIngredients search", () => {
  const testBase = new RepositoryTestBase("test_ingredient_catalogue");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();

    const db = getTestDb();
    const [onion] = await db
      .insert(schema.ingredients)
      .values({ name: "Onion", createdAt: new Date() })
      .returning();
    const [redOnion] = await db
      .insert(schema.ingredients)
      .values({ name: "Red onion", parentId: onion!.id, createdAt: new Date() })
      .returning();

    await db.insert(schema.ingredients).values({ name: "Chocolate", createdAt: new Date() });
    await db.insert(schema.ingredientAliases).values([
      { text: "Onion", fold: "onion", ingredientId: onion!.id },
      { text: "Ui", fold: "ui", locale: "nl", ingredientId: onion!.id },
      { text: "Red onion", fold: "red onion", ingredientId: redOnion!.id },
    ]);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const names = async (search: ReturnType<typeof parseIngredientSearch>) =>
    (await listCatalogueIngredients({ search, flaggedOnly: false, limit: 10, offset: 0 })).map(
      (row) => row.name
    );

  it("finds the text anywhere in a name, the exact name first", async () => {
    expect(await names(parseIngredientSearch("onion"))).toEqual(["Onion", "Red onion"]);
  });

  it("finds a food by a translation, and not once the field is off", async () => {
    expect(await names(parseIngredientSearch("ui"))).toEqual(["Onion"]);
    expect(await names(parseIngredientSearch("ui", { fields: ["name"] }))).toEqual([]);
  });

  it("finds exactly the name or translation with an exact match", async () => {
    expect(await names(parseIngredientSearch("onion", { match: "exact" }))).toEqual(["Onion"]);
    expect(await names(parseIngredientSearch("oni", { match: "exact" }))).toEqual([]);
  });

  it("finds every kind of a food by its parent, by name or translation", async () => {
    expect(await names(parseIngredientSearch("ui", { fields: ["parent"] }))).toEqual(["Red onion"]);
    expect(
      await names(parseIngredientSearch("onion", { match: "exact", fields: ["parent"] }))
    ).toEqual(["Red onion"]);
  });

  it("lists everything without a search", async () => {
    expect(await names(null)).toEqual(["Chocolate", "Onion", "Red onion"]);
  });
});

/**
 * What still uses a food: the spellings something points at, and the uses
 * one viewer may see, the rest counted.
 */
describe("ingredient uses", () => {
  const testBase = new RepositoryTestBase("test_ingredient_uses");
  let me: { id: string };
  let chickenId: string;
  let recipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();

    const db = getTestDb();
    const neighbour = await createTestUser();
    const chicken = await createTestIngredient({ name: "kipfilet" });
    const [hand] = await db
      .insert(schema.ingredientAliases)
      .values({
        text: "kipfilet met de hand",
        fold: "kipfilet met de hand",
        ingredientId: chicken!.id,
      })
      .returning();

    me = (await createTestUser())!;
    chickenId = chicken!.id;
    recipeId = (await createTestRecipe(me.id, { name: "Saté" })).id;
    // Two lines of one recipe, through the food's own name.
    await createTestRecipeIngredients(recipeId, chickenId, "metric");
    await createTestRecipeIngredients(recipeId, chickenId, "metric", { order: "1" });
    await db.insert(schema.groceries).values([
      { userId: me.id, name: "kipfilet met de hand", ingredientAliasId: hand!.id, isDone: true },
      { userId: neighbour!.id, name: "kipfilet", ingredientId: chickenId },
    ]);
    await db.insert(schema.pantryIngredients).values({ userId: me.id, ingredientId: chickenId });
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("marks a spelling something points at as in use", async () => {
    const [row] = await listCatalogueIngredients({
      search: null,
      flaggedOnly: false,
      limit: 10,
      offset: 0,
    });

    expect(row!.aliases.map(({ text, inUse }) => [text, inUse])).toEqual([
      ["kipfilet", true],
      ["kipfilet met de hand", true],
    ]);
    await getTestDb().delete(schema.recipeIngredients);
    expect((await listCatalogueAliasesOf(chickenId)).map(({ inUse }) => inUse)).toEqual([
      false,
      true,
    ]);
  });

  it("lists the uses the viewer may see, a recipe once, and counts the rest", async () => {
    expect(
      await listIngredientUses(
        { userId: me.id, userIds: [me.id], householdUserIds: null, isServerAdmin: false },
        chickenId
      )
    ).toEqual({
      recipes: [{ id: recipeId, name: "Saté" }],
      groceries: [{ name: "kipfilet met de hand", done: true, recurring: false }],
      pantry: true,
      elsewhere: 1,
    });
  });
});
