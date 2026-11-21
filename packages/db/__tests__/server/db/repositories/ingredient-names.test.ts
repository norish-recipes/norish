// @vitest-environment node
/** Ingredients' names by id, in one query: what the Search chips name their Ingredients by. */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  findIngredientDisplayNames,
  findIngredientNamesByIds,
} from "@norish/db/repositories/ingredient-aliases";
import * as schema from "@norish/db/schema";

import { createTestIngredient, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("findIngredientNamesByIds", () => {
  const testBase = new RepositoryTestBase("test_ingredient_names");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("names each Ingredient by id, as it is named now, and leaves out one that is gone", async () => {
    const onion = (await createTestIngredient({ name: "onion" }))!;
    const garlic = (await createTestIngredient({ name: "garlic" }))!;
    const gone = "a0000000-0000-4000-8000-000000000001";

    await getTestDb()
      .update(schema.ingredients)
      .set({ name: "red onion" })
      .where(eq(schema.ingredients.id, onion.id));

    expect(await findIngredientNamesByIds([onion.id, garlic.id, gone, onion.id])).toEqual(
      new Map([
        [onion.id, "red onion"],
        [garlic.id, "garlic"],
      ])
    );
    expect(await findIngredientNamesByIds([])).toEqual(new Map());
  });

  it("gives each Ingredient its spellings per language too, as the catalogue's other reads do", async () => {
    const chicken = (await createTestIngredient({ name: "Chicken" }))!;
    const salt = (await createTestIngredient({ name: "Salt" }))!;
    const gone = "a0000000-0000-4000-8000-000000000001";

    await getTestDb()
      .insert(schema.ingredientAliases)
      .values({ text: "Kip", fold: "kip", ingredientId: chicken.id, locale: "nl" });

    expect(await findIngredientDisplayNames([chicken.id, salt.id, gone])).toEqual(
      new Map([
        [chicken.id, { name: "Chicken", localeNames: { nl: "Kip" } }],
        [salt.id, { name: "Salt", localeNames: {} }],
      ])
    );
  });
});
