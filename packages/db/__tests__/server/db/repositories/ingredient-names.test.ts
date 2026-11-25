// @vitest-environment node
/** Ingredients' names by id, in one query: what the Search chips name their Ingredients by. */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  findIngredientDisplayNames,
  findIngredientNamesByIds,
} from "@norish/db/repositories/ingredient-aliases";
import * as schema from "@norish/db/schema";

import {
  createTestIngredient,
  createTestUser,
  getTestDb,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("findIngredientNamesByIds", () => {
  const testBase = new RepositoryTestBase("test_ingredient_names");

  beforeAll(async () => {
    await testBase.setup();
  });

  let mine: string;
  let theirs: string;

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    mine = testHouseholdOf(user.id);
    theirs = testHouseholdOf((await createTestUser()).id);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("names each Ingredient by id, as it is named now, leaving out one gone or another household's", async () => {
    const onion = (await createTestIngredient({ name: "onion" }))!;
    const garlic = (await createTestIngredient({ name: "garlic", householdId: mine }))!;
    const elsewhere = (await createTestIngredient({ name: "leek", householdId: theirs }))!;
    const gone = "a0000000-0000-4000-8000-000000000001";

    await getTestDb()
      .update(schema.ingredients)
      .set({ name: "red onion" })
      .where(eq(schema.ingredients.id, onion.id));

    expect(
      await findIngredientNamesByIds(mine, [onion.id, garlic.id, elsewhere.id, gone, onion.id])
    ).toEqual(
      new Map([
        [onion.id, "red onion"],
        [garlic.id, "garlic"],
      ])
    );
    expect(await findIngredientNamesByIds(theirs, [garlic.id, elsewhere.id])).toEqual(
      new Map([[elsewhere.id, "leek"]])
    );
    expect(await findIngredientNamesByIds(mine, [])).toEqual(new Map());
  });

  it("gives each Ingredient its spellings per language too, the household's and the seed's alone", async () => {
    const chicken = (await createTestIngredient({ name: "Chicken" }))!;
    const salt = (await createTestIngredient({ name: "Salt" }))!;
    const gone = "a0000000-0000-4000-8000-000000000001";

    await getTestDb()
      .insert(schema.ingredientAliases)
      .values([
        { text: "Kip", fold: "kip", ingredientId: chicken.id, locale: "nl" },
        {
          householdId: theirs,
          text: "Pollo",
          fold: "pollo",
          ingredientId: chicken.id,
          locale: "es",
        },
      ]);

    expect(await findIngredientDisplayNames(mine, [chicken.id, salt.id, gone])).toEqual(
      new Map([
        [chicken.id, { name: "Chicken", localeNames: { nl: "Kip" } }],
        [salt.id, { name: "Salt", localeNames: {} }],
      ])
    );
  });
});
