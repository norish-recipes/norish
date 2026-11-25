// @vitest-environment node
/** The typing suggestions against a real database: foods, Tags and Categories the reader's recipes hold. */

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { listLibrary, listLibrarySuggestions } from "@norish/db/repositories/library";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import { ingredientAliases, ingredients } from "@norish/db/schema";

import {
  attachTestEntry,
  createTestRecipe,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

function viewer(userId: string): RecipeListContext {
  return { userId, householdId: testHouseholdOf(userId) };
}

describe("the typing suggestions", () => {
  const testBase = new RepositoryTestBase("test_library_suggestions");
  let ownerId: string;
  let strangerId: string;
  let clock = 0;
  /** One clock for every row, so no ordering rests on this machine's time. */
  const minute = () => new Date(Date.UTC(2026, 0, 1, 12, clock++));

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    ownerId = user.id;
    strangerId = (await createTestUser({ name: "Stranger" })).id;
    clock = 0;
    await deleteConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** A recipe of `userId` with one line naming each food (by the spelling given, else its first). */
  async function recipeNaming(userId: string, foods: { aliasId: string }[], name = "Dish") {
    const recipe = await createTestRecipe(userId, { name, createdAt: minute() });

    for (const [i, food] of foods.entries()) {
      await insertTestRecipeLine({ recipeId: recipe.id, name: `line ${i}`, order: String(i) }, [
        food.aliasId,
      ]);
    }

    return recipe;
  }

  const food = (text: string) => mintTestFood(text);
  const ask = async (text: string, as = ownerId) => await listLibrarySuggestions(viewer(as), text);
  const names = async (text: string, as = ownerId) =>
    (await ask(text, as)).ingredients.map((each) => each.name);

  async function tagRecipes(recipeIds: string[], name: string) {
    await attachTestEntry("tag", recipeIds, name);
  }

  async function categorise(recipeIds: string[], name: string) {
    await attachTestEntry("category", recipeIds, name);
  }

  describe("Ingredients", () => {
    it("matches the start of a word of the name, folded for case and accents", async () => {
      const creme = await food("Crème fraîche");
      const chicken = await food("Chicken");

      await recipeNaming(ownerId, [creme, chicken]);

      expect(await names("CREME")).toEqual(["Crème fraîche"]);
      expect(await names("fraiche")).toEqual(["Crème fraîche"]);
      expect(await names("  chick ")).toEqual(["Chicken"]);
      expect(await names("hicken")).toEqual([]);
    });

    it("matches any Ingredient Alias and shows the Ingredient's name", async () => {
      const coriander = await food("Coriander");

      await getTestDb().insert(ingredientAliases).values({
        text: "Cilantro",
        fold: "cilantro",
        ingredientId: coriander.ingredientId,
        locale: "en",
      });
      await recipeNaming(ownerId, [coriander]);

      const [hit] = (await ask("cilan")).ingredients;

      expect(hit).toMatchObject({ id: coriander.ingredientId, name: "Coriander" });
      expect(hit!.localeNames).toEqual({ en: "Cilantro" });
    });

    it("counts a recipe once, however many lines or spellings name the food", async () => {
      const chicken = await food("Chicken");
      const chickpea = await food("Chickpea");
      const [other] = await getTestDb()
        .insert(ingredientAliases)
        .values({ text: "Hen", fold: "hen", ingredientId: chicken.ingredientId })
        .returning();

      // Chicken in two lines of one recipe still counts one; chickpea in two recipes counts two.
      await recipeNaming(ownerId, [chicken, { aliasId: other!.id }, chickpea]);
      await recipeNaming(ownerId, [chickpea]);

      expect(await names("chic")).toEqual(["Chickpea", "Chicken"]);
    });

    it("lists the most used first, ties by name, at most three", async () => {
      const foods = [await food("Chard"), await food("Cherry"), await food("Chive")];
      const rare = await food("Chervil");
      const popular = await food("Chicory");

      await recipeNaming(ownerId, [popular]);
      await recipeNaming(ownerId, [popular]);
      await recipeNaming(ownerId, [rare]);

      for (const each of foods) await recipeNaming(ownerId, [each]);

      expect(await names("ch")).toEqual(["Chicory", "Chard", "Cherry"]);
    });

    it("leaves out the applied Ingredients before the cap", async () => {
      const popular = await food("Chicory");

      await recipeNaming(ownerId, [popular]);
      await recipeNaming(ownerId, [popular]);
      for (const each of [await food("Chard"), await food("Cherry"), await food("Chive")]) {
        await recipeNaming(ownerId, [each]);
      }

      const answer = await listLibrarySuggestions(viewer(ownerId), "ch", {
        ingredientIds: [popular.ingredientId],
        tags: [],
      });

      expect(answer.ingredients.map((each) => each.name)).toEqual(["Chard", "Cherry", "Chive"]);
    });

    it("leaves out a food only a recipe the reader cannot see names", async () => {
      await setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view: "household", edit: "household", delete: "household" },
        null,
        false
      );

      const hidden = await food("Hidden leek");
      const shared = await food("Leek stock");

      await recipeNaming(strangerId, [hidden]);
      await recipeNaming(ownerId, [shared]);

      expect(await names("leek")).toEqual(["Leek stock"]);
      expect(await names("leek", strangerId)).toEqual(["Hidden leek"]);
    });

    it("matches the Ingredient's own name when no alias holds it", async () => {
      const chicken = await food("Chicken");

      // The food's only spelling is "Hen": nothing holds its name as an alias.
      await getTestDb()
        .update(ingredientAliases)
        .set({ text: "Hen", fold: "hen" })
        .where(sql`${ingredientAliases.id} = ${chicken.aliasId}`);
      await recipeNaming(ownerId, [chicken]);

      expect(await names("chick")).toEqual(["Chicken"]);
      expect(await names("hen")).toEqual(["Chicken"]);
    });

    describe("kinds", () => {
      async function kindOf(parent: { ingredientId: string }, kind: { ingredientId: string }) {
        await getTestDb()
          .update(ingredients)
          .set({ parentId: parent.ingredientId })
          .where(sql`${ingredients.id} = ${kind.ingredientId}`);
      }

      it("suggests a parent food whose recipes only name its kinds", async () => {
        const chicken = await food("Chicken");
        const thighs = await food("Chicken thighs");

        await kindOf(chicken, thighs);
        await recipeNaming(ownerId, [thighs]);

        expect(await names("chicken")).toEqual(["Chicken", "Chicken thighs"]);
      });

      it("ranks a parent by the recipes of its kinds, each recipe once", async () => {
        const chicken = await food("Chicken");
        const thighs = await food("Chicken thighs");
        const wings = await food("Chicken wings");
        const chickpea = await food("Chickpea");

        await kindOf(chicken, thighs);
        await kindOf(chicken, wings);
        await recipeNaming(ownerId, [thighs, wings]);
        await recipeNaming(ownerId, [thighs]);
        await recipeNaming(ownerId, [chickpea]);
        await recipeNaming(ownerId, [chickpea]);

        // Chicken: 2 recipes through its kinds; thighs 2; chickpea 2; wings 1. Ties by name.
        expect(await names("chick")).toEqual(["Chicken", "Chicken thighs", "Chickpea"]);
      });

      it("leaves out an ancestor whose name does not match, and counts only visible recipes", async () => {
        await setConfig(
          ServerConfigKeys.RECIPE_PERMISSION_POLICY,
          { view: "household", edit: "household", delete: "household" },
          null,
          false
        );

        const poultry = await food("Poultry");
        const thighs = await food("Chicken thighs");
        const chicken = await food("Chicken");

        await kindOf(poultry, chicken);
        await kindOf(chicken, thighs);
        await recipeNaming(ownerId, [thighs]);
        await recipeNaming(strangerId, [thighs]);

        expect(await names("chick")).toEqual(["Chicken", "Chicken thighs"]);
        expect(await names("poul")).toEqual(["Poultry"]);
        expect(await names("zzz")).toEqual([]);
      });

      it("only suggests what narrowing to would return at least one recipe for", async () => {
        const chicken = await food("Chicken");
        const thighs = await food("Chicken thighs");
        const unused = await food("Chicken livers");

        await kindOf(chicken, thighs);
        await kindOf(chicken, unused);
        await recipeNaming(ownerId, [thighs]);

        const suggested = (await ask("chick")).ingredients;

        expect(suggested.length).toBeGreaterThan(0);

        for (const { id } of suggested) {
          const { total } = await listLibrary(viewer(ownerId), {
            limit: 10,
            ingredientIds: [id],
            type: "recipes",
          });

          expect(total).toBeGreaterThan(0);
        }
        expect(suggested.map((each) => each.name)).not.toContain("Chicken livers");
      });
    });

    it("leaves out a food no recipe names", async () => {
      await food("Unused");

      expect(await names("unus")).toEqual([]);
    });
  });

  describe("Tags and Categories", () => {
    it("lists Tags that match, most used first, at most three", async () => {
      const [one, two] = [
        await recipeNaming(ownerId, [], "One"),
        await recipeNaming(ownerId, [], "Two"),
      ];

      await tagRecipes([one.id, two.id], "Quick meal");
      await tagRecipes([one.id], "quiche");
      await tagRecipes([one.id], "Quinoa");
      await tagRecipes([one.id], "Quail");

      expect((await ask("qu")).tags).toEqual(["Quick meal", "Quail", "quiche"]);
    });

    it("offers households' Tags folding alike once, as the reader's household spells it", async () => {
      await tagRecipes([(await recipeNaming(ownerId, [], "Ours")).id], "Soja");
      await tagRecipes(
        [
          (await recipeNaming(strangerId, [], "Theirs")).id,
          (await recipeNaming(strangerId, [], "Theirs too")).id,
        ],
        "soja!"
      );

      expect((await ask("so")).tags).toEqual(["Soja"]);
      expect((await ask("so", strangerId)).tags).toEqual(["soja!"]);
    });

    it("leaves out the applied Tags, in any case, before the cap", async () => {
      const [one, two] = [
        await recipeNaming(ownerId, [], "One"),
        await recipeNaming(ownerId, [], "Two"),
      ];

      await tagRecipes([one.id, two.id], "Quick meal");
      await tagRecipes([one.id], "quiche");
      await tagRecipes([one.id], "Quinoa");
      await tagRecipes([one.id], "Quail");

      const answer = await listLibrarySuggestions(viewer(ownerId), "qu", {
        ingredientIds: [],
        tags: ["quick MEAL"],
      });

      expect(answer.tags).toEqual(["Quail", "quiche", "Quinoa"]);
    });

    it("folds case and accents and matches the start of a word", async () => {
      const recipe = await recipeNaming(ownerId, [], "Soup");

      await tagRecipes([recipe.id], "Crème brûlée");

      expect((await ask("CREME")).tags).toEqual(["Crème brûlée"]);
      expect((await ask("brul")).tags).toEqual(["Crème brûlée"]);
      expect((await ask("rème")).tags).toEqual([]);
    });

    it("lists every Category on a recipe the reader can see, most used first, whatever was typed", async () => {
      const [one, two, three] = [
        await recipeNaming(ownerId, [], "One"),
        await recipeNaming(ownerId, [], "Two"),
        await recipeNaming(ownerId, [], "Three"),
      ];

      await categorise([one.id, two.id], "Dinner");
      await categorise([three.id], "Dessert");
      await categorise([three.id], "Drinks");
      await categorise([three.id], "Dips");

      // The reader's language names a Category, so the client matches the text, not the server.
      expect((await ask("diner")).categories).toEqual(["Dinner", "Dessert", "Dips", "Drinks"]);
    });

    it("leaves out Tags and Categories only on a recipe the reader cannot see", async () => {
      await setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view: "household", edit: "household", delete: "household" },
        null,
        false
      );

      const theirs = await recipeNaming(strangerId, [], "Theirs");
      const mine = await recipeNaming(ownerId, [], "Mine");

      await tagRecipes([theirs.id], "secret");
      await tagRecipes([mine.id], "sesame");
      await categorise([theirs.id], "Supper");

      expect((await ask("se")).tags).toEqual(["sesame"]);
      expect((await ask("sup")).categories).toEqual([]);
    });
  });

  it("returns nothing for empty or termless text", async () => {
    const recipe = await recipeNaming(ownerId, [await food("Chicken")]);

    await tagRecipes([recipe.id], "chicken");
    await categorise([recipe.id], "Chicken dinner");

    for (const text of ["", "   ", "^", "!!"]) {
      expect(await ask(text)).toEqual({ ingredients: [], tags: [], categories: [] });
    }
  });
});
