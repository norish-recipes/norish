// @vitest-environment node
/**
 * The ingredient resolver against a real database: a text as written comes
 * in, the alias it resolves to comes out, and an Ingredient is minted only
 * when nothing Norish knows matches.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRecipeWithRefs, getRecipeFull, updateRecipeWithRefs } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import { addPantryIngredient } from "@norish/db/repositories/pantry";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import {
  findIngredientFor,
  ingredientFor,
  resolveIngredient,
  resolveIngredients,
  writeResolved,
} from "@norish/shared-server/ingredients/resolver";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

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

  it("reads a bracket never closed as preparation to the end of the text", async () => {
    const onions = await resolveOne("onions");

    expect((await resolveOne("onions (red, diced")).ingredientId).toBe(onions.ingredientId);
    expect((await resolveOne("onions [red, diced")).ingredientId).toBe(onions.ingredientId);
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

  it("resolves and writes once more when a merge lands between the two, on the food it left", async () => {
    const onion = await resolveOne("onion");
    const ui = await resolveOne("ui");
    let resolves = 0;
    let writes = 0;

    const { item } = await writeResolved(
      async () => {
        resolves += 1;
        const resolved = await resolveOne("ui");

        // A housemate merges "ui" into onion after this resolve and before its write.
        if (resolves === 1) {
          await withTransaction((tx) =>
            mergeCatalogueIngredients(tx, ui.ingredientId, onion.ingredientId)
          );
        }

        return resolved;
      },
      async (resolved) => {
        writes += 1;

        return await addPantryIngredient(crypto.randomUUID(), {
          userId,
          userIds: [userId],
          ingredientAliasId: resolved.aliasId,
          ingredientId: resolved.ingredientId,
        });
      }
    );

    expect([resolves, writes]).toEqual([2, 2]);
    expect(item.ingredientId).toBe(onion.ingredientId);
  });

  it("does not retry a write refused for any other reason", async () => {
    let writes = 0;

    await expect(
      writeResolved(
        () => resolveOne("onion"),
        async () => {
          writes += 1;
          throw new Error("refused");
        }
      )
    ).rejects.toThrow("refused");
    expect(writes).toBe(1);
  });

  it("finds what a text already resolves to without minting anything", async () => {
    const onions = await resolveOne("onions");

    await expect(findIngredientFor("Onions, sliced")).resolves.toEqual({
      aliasId: onions.aliasId,
      ingredientId: onions.ingredientId,
    });
    await expect(findIngredientFor("leeks")).resolves.toBeNull();
    // Still unknown: the lookup above left nothing behind.
    await expect(findIngredientFor("leeks")).resolves.toBeNull();
  });

  it("answers nothing for a text that is markup alone, and mints nothing", async () => {
    await expect(resolveIngredient("<br>&nbsp;", { userId })).resolves.toBeNull();
    await expect(resolveIngredient("Leeks", { userId })).resolves.toMatchObject({ text: "Leeks" });
  });

  it("a mint that loses the race for one of its spellings joins the winner with the other", async () => {
    // Another request minted "onions, diced" between this mint's read and write.
    const [winner] = await mintIngredientWithAliases({
      name: "onions, diced",
      aliases: [{ text: "onions, diced", fold: ingredientAliasFold("onions, diced") }],
      ownerId: userId,
      locale: null,
      flagged: true,
    });

    const rows = await mintIngredientWithAliases({
      name: "onions",
      aliases: [
        { text: "onions, diced", fold: ingredientAliasFold("onions, diced") },
        { text: "onions", fold: ingredientAliasFold("onions") },
      ],
      ownerId: userId,
      locale: null,
      flagged: true,
    });

    expect(rows.map((row) => row.ingredientId)).toEqual([
      winner!.ingredientId,
      winner!.ingredientId,
    ]);
    expect((await resolveOne("onions")).ingredientId).toBe(winner!.ingredientId);
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

    it("leaves out a line whose text is markup alone, and saves the rest", async () => {
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Soup",
            systemUsed: "metric",
            recipeIngredients: [line("&nbsp;", 0), line("leeks", 1)],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { ingredientName: "leeks" },
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
