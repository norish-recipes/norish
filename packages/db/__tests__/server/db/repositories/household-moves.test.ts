// @vitest-environment node
/**
 * Leaving takes a member's recipes with what they carry of the household; joining from a
 * household of one merges it into the joined household (ADR-0041, 0042, 0043).
 */
import { and, eq, isNotNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  deleteAccount,
  getHouseholdIdForUser,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
} from "@norish/db/repositories/households";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import {
  addEntry,
  appendRecipeEntriesTx,
  deleteEntry,
  findOwnEntry,
  mergeEntries,
  recipeEntryNames,
  renameEntry,
} from "@norish/db/repositories/list-entries";
import { saveRecipeNutritionEstimate } from "@norish/db/repositories/recipe-enrichment";
import {
  categories,
  cuisines,
  ingredientAliases,
  ingredients,
  recipeCategories,
  recipeCuisines,
  recipeIngredientFoods,
  recipeIngredients,
  recipeNutritionEstimates,
  recipes,
  recipeTags,
  tags,
} from "@norish/db/schema";
import { lineKey } from "@norish/shared/lib/recipe-nutrition";

import {
  addTestSpelling,
  createTestIngredient,
  createTestRecipe,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
  readTestIngredient,
  setTestIngredients,
  testLineAliasIds,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const LISTS = [
  { kind: "tag", table: tags, link: recipeTags, entity: recipeTags.tagId },
  { kind: "cuisine", table: cuisines, link: recipeCuisines, entity: recipeCuisines.cuisineId },
  {
    kind: "category",
    table: categories,
    link: recipeCategories,
    entity: recipeCategories.categoryId,
  },
] as const;

/** Recipe links to an entry of a household other than the recipe's own. */
async function foreignEntryLinks() {
  const found: Array<{ kind: string; recipeId: string; entryId: string }> = [];

  for (const { kind, table, link, entity } of LISTS) {
    const rows = await getTestDb()
      .select({ recipeId: link.recipeId, entryId: table.id })
      .from(link)
      .innerJoin(table, eq(table.id, entity))
      .innerJoin(recipes, eq(recipes.id, link.recipeId))
      .where(and(isNotNull(table.householdId), ne(table.householdId, recipes.householdId)));

    found.push(...rows.map((row) => ({ kind, ...row })));
  }

  return found;
}

/** Recipe lines naming a food or spelling of a household other than the recipe's own. */
async function foreignLineFoods() {
  const food = alias(ingredients, "line_food");

  return await getTestDb()
    .select({ lineId: recipeIngredientFoods.recipeIngredientId })
    .from(recipeIngredientFoods)
    .innerJoin(
      recipeIngredients,
      eq(recipeIngredients.id, recipeIngredientFoods.recipeIngredientId)
    )
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .innerJoin(food, eq(food.id, ingredientAliases.ingredientId))
    .where(
      or(
        and(
          isNotNull(ingredientAliases.householdId),
          ne(ingredientAliases.householdId, recipes.householdId)
        ),
        and(isNotNull(food.householdId), ne(food.householdId, recipes.householdId))
      )
    );
}

/** Neither a recipe nor a line names anything of another household. */
async function expectNothingForeign() {
  expect(await foreignEntryLinks()).toEqual([]);
  expect(await foreignLineFoods()).toEqual([]);
}

describe("household moves", () => {
  const testBase = new RepositoryTestBase("test_household_moves");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function householdOf(userId: string): Promise<string> {
    const id = await getHouseholdIdForUser(userId);

    expect(id).not.toBeNull();

    return id!;
  }

  async function sharedHousehold() {
    const admin = await createTestUser();
    const member = await createTestUser();
    const householdId = await householdOf(admin.id);

    expect(await joinHousehold(member.id, { householdId })).toHaveProperty("joined");

    return { admin, member, householdId };
  }

  async function carry(kind: "tag" | "cuisine" | "category", recipeId: string, names: string[]) {
    await getTestDb().transaction((tx) => appendRecipeEntriesTx(tx, kind, recipeId, names));
  }

  async function entryOf(kind: "tag" | "cuisine" | "category", scope: string | null, name: string) {
    const added = await addEntry(kind, scope, name);

    return added!.entry;
  }

  describe("leaving keeps the recipes' lists", () => {
    it.each(["leave", "remove"] as const)(
      "%s: the household's entries become the new household's, the instance's stay",
      async (how) => {
        const { admin, member, householdId } = await sharedHousehold();
        const leaving = await createTestRecipe(member.id, { name: "Curry" });
        const staying = await createTestRecipe(admin.id, { name: "Stew" });
        const italian = await entryOf("cuisine", null, "Italian");

        await carry("tag", leaving.id, ["Spicy", "BBQ"]);
        await carry("tag", staying.id, ["spicy"]);
        await carry("category", leaving.id, ["Weeknight", "Dinner"]);
        await carry("cuisine", leaving.id, ["Fusion", "Italian"]);

        const moved =
          how === "leave"
            ? await moveToHouseholdOfOne(householdId, member.id)
            : await kickUserFromHousehold(householdId, member.id, admin.id);
        const newHousehold = moved.applied ? moved.value.household.id : "";

        expect(await recipeEntryNames("tag", leaving.id)).toEqual(["Spicy", "BBQ"]);
        expect(await recipeEntryNames("category", leaving.id)).toEqual(["Weeknight", "Dinner"]);
        expect(await recipeEntryNames("cuisine", leaving.id)).toEqual(["Fusion", "Italian"]);
        expect(await recipeEntryNames("tag", staying.id)).toEqual(["Spicy"]);

        const cuisinesCarried = await getTestDb()
          .select({ id: cuisines.id, householdId: cuisines.householdId })
          .from(recipeCuisines)
          .innerJoin(cuisines, eq(cuisines.id, recipeCuisines.cuisineId))
          .where(eq(recipeCuisines.recipeId, leaving.id));

        expect(cuisinesCarried).toEqual(
          expect.arrayContaining([
            { id: italian.id, householdId: null },
            { id: expect.any(String), householdId: newHousehold },
          ])
        );
        // The old household keeps its entries, each on its own recipes only.
        const oldTags = await getTestDb()
          .select({ name: tags.name })
          .from(tags)
          .where(eq(tags.householdId, householdId));

        expect(oldTags.map((row) => row.name).sort()).toEqual(["BBQ", "Spicy"]);
        await expectNothingForeign();
      }
    );

    it("the old household's rename, merge and delete no longer reach the leaver's recipes", async () => {
      const { admin, member, householdId } = await sharedHousehold();
      const leaving = await createTestRecipe(member.id);

      await carry("tag", leaving.id, ["Spicy", "Quick", "Hot"]);
      const spicy = await entryOf("tag", householdId, "Spicy");
      const quick = await entryOf("tag", householdId, "Quick");
      const hot = await entryOf("tag", householdId, "Hot");

      await moveToHouseholdOfOne(householdId, member.id);

      expect(await renameEntry("tag", householdId, spicy, "Mild")).toMatchObject({ applied: true });
      expect(
        await mergeEntries(
          "tag",
          householdId,
          hot,
          (await findOwnEntry("tag", householdId, spicy.id))!
        )
      ).toMatchObject({ applied: true });
      expect(await deleteEntry("tag", householdId, quick)).toEqual({
        applied: true,
        stale: false,
        value: { detached: 0 },
      });
      expect(await recipeEntryNames("tag", leaving.id)).toEqual(["Spicy", "Quick", "Hot"]);
      void admin;
    });

    it("deleting the old household's last member leaves the leaver's entries", async () => {
      const { admin, member, householdId } = await sharedHousehold();
      const leaving = await createTestRecipe(member.id);

      await carry("tag", leaving.id, ["Spicy"]);
      await carry("category", leaving.id, ["Weeknight"]);
      await moveToHouseholdOfOne(householdId, member.id);
      await deleteAccount(admin.id);

      expect(await recipeEntryNames("tag", leaving.id)).toEqual(["Spicy"]);
      expect(await recipeEntryNames("category", leaving.id)).toEqual(["Weeknight"]);
      await expectNothingForeign();
    });
  });
});
