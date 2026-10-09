// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listCatalogueIngredients } from "@norish/db/repositories/ingredient-catalogue";
import * as schema from "@norish/db/schema";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";

import { getTestDb } from "../../../helpers/db-test-helpers";
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
