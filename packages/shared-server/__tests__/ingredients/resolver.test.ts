// @vitest-environment node
/**
 * The ingredient resolver against a real database: a text as written comes
 * in, the alias it resolves to comes out, and an Ingredient is minted only
 * when nothing Norish knows matches.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import defaultUnits from "@norish/config/units.default.json";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { createRecipeWithRefs, getRecipeFull, updateRecipeWithRefs } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import { addPantryIngredient } from "@norish/db/repositories/pantry";
import { setConfig } from "@norish/db/repositories/server-config";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import {
  findIngredientFor,
  forgetSpellingRules,
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

    // Each test starts on the units map its own database holds.
    forgetSpellingRules();

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

  it("recognises a known food under a units-map phrase at either end of the text", async () => {
    const salt = await resolveOne("salt");
    const nutmeg = await resolveOne("nutmeg");
    const sauce = await resolveOne("sweet chilli sauce");

    expect((await resolveOne("Salt to taste")).ingredientId).toBe(salt.ingredientId);
    expect((await resolveOne("a pinch of nutmeg")).ingredientId).toBe(nutmeg.ingredientId);
    expect((await resolveOne("sweet chilli sauce to serve")).ingredientId).toBe(sauce.ingredientId);
    expect((await resolveOne("salt, to taste")).ingredientId).toBe(salt.ingredientId);
  });

  it("keeps a units-map phrase inside the name", async () => {
    const cream = await resolveOne("cream");

    expect((await resolveOne("cream to taste with sugar")).ingredientId).not.toBe(
      cream.ingredientId
    );
  });

  it("strips the phrases the administrator's units map has, and only those", async () => {
    const nutmeg = await resolveOne("nutmeg");
    // The administrator's own map: a household's phrasing added to "pinch",
    // and "to taste" gone with the rest of the defaults.
    const units = {
      pinch: {
        short: [{ locale: "en", name: "pinch" }],
        plural: [{ locale: "en", name: "pinches" }],
        alternates: ["a smidgen"],
      },
    };

    expect((await resolveOne("a smidgen of nutmeg")).ingredientId).not.toBe(nutmeg.ingredientId);
    await setConfig(ServerConfigKeys.UNITS, { units, isOverridden: true }, null, false);
    forgetSpellingRules();
    expect((await resolveOne("smidgen of nutmeg, grated")).ingredientId).not.toBe(
      nutmeg.ingredientId
    );
    expect((await resolveOne("a smidgen nutmeg")).ingredientId).toBe(nutmeg.ingredientId);
    expect((await resolveOne("nutmeg to taste")).ingredientId).not.toBe(nutmeg.ingredientId);
  });

  it("recognises a known food under preparation written without a comma, and a container", async () => {
    // The containers come from the units map: the default one, not the test above's.
    await setConfig(
      ServerConfigKeys.UNITS,
      { units: defaultUnits, isOverridden: false },
      null,
      false
    );
    forgetSpellingRules();
    const garlic = await resolveOne("garlic cloves");
    const chickpeas = await resolveOne("chickpeas");

    expect((await resolveOne("garlic cloves crushed")).ingredientId).toBe(garlic.ingredientId);
    expect((await resolveOne("finely chopped garlic cloves")).ingredientId).toBe(
      garlic.ingredientId
    );
    expect((await resolveOne("can of chickpeas drained and rinsed")).ingredientId).toBe(
      chickpeas.ingredientId
    );
    // A quantity an import left at the start goes first, and then the can is at the start.
    expect((await resolveOne("400g can chickpeas")).ingredientId).toBe(chickpeas.ingredientId);
  });

  it("names a new food for its text without such preparation, and keeps the text as a spelling", async () => {
    const minted = await resolveOne("Fresh coconut grated");

    await expect(ingredientFor(minted.aliasId)).resolves.toMatchObject({ name: "Fresh coconut" });
    expect((await resolveOne("fresh coconut")).ingredientId).toBe(minted.ingredientId);
    expect((await resolveOne("fresh coconut, grated")).ingredientId).toBe(minted.ingredientId);
  });

  it("never strips a measure or a piece, which name foods too", async () => {
    const onion = await resolveOne("onion");

    expect((await resolveOne("onion rings")).ingredientId).not.toBe(onion.ingredientId);
  });

  it("resolves a plural or a diminutive to the food it names, in any language", async () => {
    const tomato = await resolveOne("tomato");
    const bosui = await resolveOne("bosui");
    const zwiebel = await resolveOne("Zwiebel");

    expect((await resolveOne("tomatoes")).ingredientId).toBe(tomato.ingredientId);
    expect((await resolveOne("bosuien")).ingredientId).toBe(bosui.ingredientId);
    expect((await resolveOne("bosuitjes")).ingredientId).toBe(bosui.ingredientId);
    expect((await resolveOne("rote Zwiebeln")).ingredientId).not.toBe(zwiebel.ingredientId);
    expect((await resolveOne("Zwiebeln")).ingredientId).toBe(zwiebel.ingredientId);
    // And the reverse: a singular finds a food known only by its plural.
    const krieltjes = await resolveOne("krieltjes");

    expect((await resolveOne("krieltje")).ingredientId).toBe(krieltjes.ingredientId);
  });

  it("reads past a quantity an import left at a name's start, and its size", async () => {
    const bosui = await resolveOne("bosui");

    expect((await resolveOne("ongeveer 4 el fijngesneden bosui")).ingredientId).toBe(
      bosui.ingredientId
    );
    expect((await resolveOne("4el bosui")).ingredientId).toBe(bosui.ingredientId);
    expect((await resolveOne("grote bosui")).ingredientId).toBe(bosui.ingredientId);
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

    it("keeps a heading as a line that names no food, and mints nothing for it", async () => {
      const sauce = await resolveOne("sauce");
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Soup",
            systemUsed: "metric",
            recipeIngredients: [
              line("# Sauce", 0),
              line("# For the topping:", 1),
              line("leeks", 2),
            ],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { ingredientName: "# Sauce", ingredientId: null },
        { ingredientName: "# For the topping:", ingredientId: null },
        { ingredientName: "leeks" },
      ]);
      // "# Sauce" folds like "sauce", and still never became a spelling of it.
      await expect(findIngredientFor("# For the topping:")).resolves.toBeNull();
      expect((await resolveOne("sauce")).ingredientId).toBe(sauce.ingredientId);
    });

    it("keeps a line that is an amount alone as naming no food, and mints nothing for it", async () => {
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Gehaktballen",
            systemUsed: "metric",
            recipeIngredients: [line("el", 0), line("GR RUNDERGEHAKT", 1)],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { ingredientName: "el", ingredientId: null },
        { ingredientName: "GR RUNDERGEHAKT" },
      ]);
      await expect(findIngredientFor("el")).resolves.toBeNull();
      // The gram an import left in the name is no part of the food's.
      const [, beef] = (await getRecipeFull(recipeId))!.recipeIngredients;

      await expect(
        ingredientFor((await resolveOne("rundergehakt")).aliasId)
      ).resolves.toMatchObject({ id: beef!.ingredientId, name: "RUNDERGEHAKT" });
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
      // A plural is its singular's food, by the ingredient words' endings.
      expect((await getRecipeFull(recipeId))?.recipeIngredients[0]?.ingredientId).toBe(
        carrot.ingredientId
      );
    });
  });
});
