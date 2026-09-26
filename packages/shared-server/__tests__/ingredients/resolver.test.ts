// @vitest-environment node
/**
 * The ingredient resolver against a real database: a text as written comes
 * in, the alias it resolves to comes out, and an Ingredient is minted only
 * when nothing Norish knows matches.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRecipeWithRefs, getRecipeFull, updateRecipeWithRefs } from "@norish/db";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import { ingredientFor, resolveIngredients } from "@norish/shared-server/ingredients/resolver";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("ingredient resolver", () => {
  const testBase = new RepositoryTestBase("test_ingredient_resolver");

  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function resolveOne(text: string) {
    const [resolved] = await resolveIngredients([text], { userId });

    return resolved!;
  }

  it("mints a flagged Ingredient, owned by the actor, for a text Norish has never seen", async () => {
    const onion = await resolveOne("Onion");

    await expect(ingredientFor(onion.aliasId)).resolves.toMatchObject({
      id: onion.ingredientId,
      name: "Onion",
      flagged: true,
      ownerId: userId,
    });
  });

  it("resolves a spelling Norish knows to the Ingredient it already has", async () => {
    const onions = await resolveOne("onions");
    const again = await resolveOne("  Onions! ");

    expect(again).toEqual({
      text: "Onions!",
      aliasId: onions.aliasId,
      ingredientId: onions.ingredientId,
    });
  });

  it("recognises a known food under its preparation", async () => {
    const onions = await resolveOne("onions");
    const tomatoes = await resolveOne("tomatoes");

    expect((await resolveOne("onions, diced")).ingredientId).toBe(onions.ingredientId);
    expect((await resolveOne("Tomatoes (canned, chopped)")).ingredientId).toBe(
      tomatoes.ingredientId
    );
  });

  it("names a new food for its text without the preparation, so later spellings join it", async () => {
    const diced = await resolveOne("onions, diced");

    await expect(ingredientFor(diced.aliasId)).resolves.toMatchObject({ name: "onions" });
    expect((await resolveOne("onions")).ingredientId).toBe(diced.ingredientId);
    expect((await resolveOne("onions, sliced")).ingredientId).toBe(diced.ingredientId);
  });

  it("never mistakes a food for another that merely shares a word", async () => {
    const salt = await resolveOne("salt");
    const butter = await resolveOne("salted butter");

    expect(butter.ingredientId).not.toBe(salt.ingredientId);
  });

  it("mints one Ingredient for texts in one call that resolve alike", async () => {
    const [first, second, third] = await resolveIngredients(
      ["garlic, minced", "Garlic", "garlic (2 cloves)"],
      { userId }
    );

    expect(second!.ingredientId).toBe(first!.ingredientId);
    expect(third!.ingredientId).toBe(first!.ingredientId);
  });

  describe("recipe lines", () => {
    function line(ingredientName: string, order: number) {
      return { ingredientId: null, ingredientName, amount: 2, unit: null, order };
    }

    it("keeps a line's text as written while it resolves to the food Norish knows", async () => {
      const onions = await resolveOne("onions");
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          { name: "Soup", systemUsed: "metric", recipeIngredients: [line("onions, diced", 0)] },
          { userId }
        )
      );

      const recipe = await getRecipeFull(recipeId);

      expect(recipe?.recipeIngredients).toMatchObject([
        { ingredientName: "onions, diced", ingredientId: onions.ingredientId, amount: 2 },
      ]);
    });

    it("re-resolves an edited line's text on update", async () => {
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          { name: "Soup", systemUsed: "metric", recipeIngredients: [line("leek", 0)] },
          { userId }
        )
      );
      const [leekLine] = (await getRecipeFull(recipeId))!.recipeIngredients;
      const carrot = await resolveOne("carrot");

      await updateRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            systemUsed: "metric",
            recipeIngredients: [{ ...line("carrots (peeled)", 0), id: leekLine!.id }],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { id: leekLine!.id, ingredientName: "carrots (peeled)" },
      ]);
      // "carrots" is not "carrot": plurals are the seed's and the Decision's to know.
      expect((await getRecipeFull(recipeId))?.recipeIngredients[0]?.ingredientId).not.toBe(
        carrot.ingredientId
      );
    });
  });
});
