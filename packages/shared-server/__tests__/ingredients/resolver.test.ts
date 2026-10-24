// @vitest-environment node
/**
 * The ingredient resolver against a real database: a text as written comes
 * in, the alias it resolves to comes out, and an Ingredient is minted only
 * when nothing Norish knows matches.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import defaultUnits from "@norish/config/units.default.json";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { createRecipeWithRefs, getRecipeFull, updateRecipeWithRefs } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import {
  findIngredientByAliasId,
  mintIngredientWithAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { addToJunkPile } from "@norish/db/repositories/ingredient-junk-pile";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import { addPantryIngredients } from "@norish/db/repositories/pantry";
import { setConfig } from "@norish/db/repositories/server-config";
import { ingredients } from "@norish/db/schema";
import { resolveGroceryNames } from "@norish/shared-server/ingredients/groceries";
import { onIngredientsMinted } from "@norish/shared-server/ingredients/minted";
import { withResolvedIngredients } from "@norish/shared-server/ingredients/recipe-lines";
import {
  cleanIngredientText,
  findIngredientFor,
  forgetSpellingRules,
  resolveIngredient,
  resolveIngredients,
  writeResolved,
} from "@norish/shared-server/ingredients/resolver";
import { DEFAULT_INGREDIENT_WORDS, ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import {
  getSpellingTexts,
  getTestDb,
  mintTestFood,
} from "../../../db/__tests__/helpers/db-test-helpers";
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

  it("mints an unflagged Ingredient, owned by the actor, for a text Norish has never seen", async () => {
    const onion = await resolveOne("Onion");

    await expect(findIngredientByAliasId(onion.aliasId)).resolves.toMatchObject({
      id: onion.ingredientId,
      name: "Onion",
      flagged: false,
      ownerId: userId,
    });
  });

  it("hands on the foods someone's action mints, never a spelling it knew nor the upgrade's", async () => {
    const minted: string[][] = [];

    onIngredientsMinted(async (ids) => void minted.push(ids));
    try {
      const [first, again] = await resolveIngredients(["paprikapoeder", "paprikapoeder"], {
        userId,
      });

      // One food minted, handed on once.
      expect(minted).toEqual([[first!.ingredientId]]);
      expect(again!.ingredientId).toBe(first!.ingredientId);

      await resolveOne("paprikapoeder");
      await resolveIngredients(["kerriepoeder"], { userId }, "upgrade");
      expect(minted).toHaveLength(1);
    } finally {
      onIngredientsMinted(undefined);
    }
  });

  it("hands on a write's mints only once the write is done, so the pass reads the rows naming them", async () => {
    const minted: string[][] = [];

    onIngredientsMinted(async (ids) => void minted.push(ids));
    try {
      const food = await writeResolved(
        () => resolveOne("kardemompeulen"),
        async (resolved) => {
          expect(minted).toEqual([]);

          return resolved;
        }
      );

      expect(minted).toEqual([[food.ingredientId]]);
    } finally {
      onIngredientsMinted(undefined);
    }
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

    await expect(findIngredientByAliasId(diced.aliasId)).resolves.toMatchObject({ name: "onions" });
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

    const [added] = await writeResolved(
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

        return await addPantryIngredients(
          [
            {
              id: crypto.randomUUID(),
              ingredientAliasId: resolved.aliasId,
              ingredientId: resolved.ingredientId,
            },
          ],
          { userId, userIds: [userId] }
        );
      }
    );

    expect([resolves, writes]).toEqual([2, 2]);
    expect(added?.item.ingredientId).toBe(onion.ingredientId);
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

    await expect(findIngredientByAliasId(minted.aliasId)).resolves.toMatchObject({
      name: "Fresh coconut",
    });
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

  it("points a text with brackets or an amount at its clean spelling, never one of its own", async () => {
    const resolved = [];

    for (const text of [
      "gyoza vellen ((ontdooid))",
      "gyoza vellen (ontdooid)",
      "12 gyoza vellen",
    ]) {
      resolved.push(await resolveOne(text));
    }

    expect(new Set(resolved.map((row) => row.aliasId)).size).toBe(1);
    await expect(getSpellingTexts(resolved[0]!.ingredientId)).resolves.toEqual(["gyoza vellen"]);
    await expect(findIngredientByAliasId(resolved[0]!.aliasId)).resolves.toMatchObject({
      name: "gyoza vellen",
    });
  });

  it("mints a text that is all brackets under its words, without them", async () => {
    const salt = await resolveOne("(salt)");

    await expect(getSpellingTexts(salt.ingredientId)).resolves.toEqual(["salt"]);
    expect((await resolveOne("(salt")).ingredientId).toBe(salt.ingredientId);
  });

  it("reads a text past stray marks, prices, notes and a leading mark, and answers it as written", async () => {
    const soda = await resolveOne("baking soda");

    for (const text of [
      "baking soda )",
      "baking soda (($0.02))",
      "baking soda $0.02",
      "baking soda (Note 1)",
      "+ baking soda",
      "/ baking soda",
      "- baking soda",
      ": baking soda",
    ]) {
      await expect(resolveOne(text)).resolves.toEqual({
        text: cleanIngredientText(text),
        aliasId: soda.aliasId,
        ingredientId: soda.ingredientId,
      });
    }
    await expect(getSpellingTexts(soda.ingredientId)).resolves.toEqual(["baking soda"]);
  });

  it("answers no food for a text with no letter or digit once cleaned, and mints nothing", async () => {
    await expect(resolveIngredients([")", "—", "($0.02)"], { userId })).resolves.toEqual([
      null,
      null,
      null,
    ]);
    await expect(getTestDb().select().from(ingredients)).resolves.toEqual([]);
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

    it("resolves a line from the food an import names, keeping the line's own text", async () => {
      const onions = await resolveOne("onions");
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Soup",
            systemUsed: "metric",
            recipeIngredients: [{ ...line("red ones, from the garden", 0), foodTexts: ["onions"] }],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { ingredientName: "red ones, from the garden", ingredientId: onions.ingredientId },
      ]);
      // The line's text never became a spelling of anything.
      await expect(findIngredientFor("red ones, from the garden")).resolves.toBeNull();
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

    it("stores no food for a colon line with no amount, and reads one with an amount as before", async () => {
      const olie = await resolveOne("olie");
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Salade",
            systemUsed: "metric",
            recipeIngredients: [
              { ...line("Voor de salade:", 0), amount: null },
              { ...line("olie:", 1), unit: "tbsp" },
            ],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { ingredientName: "Voor de salade:", ingredientId: null },
        { ingredientName: "olie:", ingredientId: olie.ingredientId },
      ]);
      await expect(findIngredientFor("Voor de salade")).resolves.toBeNull();
    });

    it("keeps a line's price as written while its food is read without it", async () => {
      const soda = await resolveOne("baking soda");
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Cookies",
            systemUsed: "metric",
            recipeIngredients: [{ ...line("baking soda ($0.02)", 0), unit: "tsp" }],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        { ingredientName: "baking soda ($0.02)", ingredientId: soda.ingredientId },
      ]);
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
        findIngredientByAliasId((await resolveOne("rundergehakt")).aliasId)
      ).resolves.toMatchObject({ id: beef!.ingredientId, name: "RUNDERGEHAKT" });
    });

    it("reads a line's food past the unit an import left beside its number, and keeps the line as written", async () => {
      const pastry = await resolveOne("bladerdeeg");
      const lettuce = await resolveOne("ijsbergsla");
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Saucijzenbroodjes",
            systemUsed: "metric",
            recipeIngredients: [
              { ...line("rol bladerdeeg", 0), amount: 1 },
              { ...line("krop ijsbergsla", 1), amount: 0.25 },
              // A unit of its own: the text is the food's, as written.
              { ...line("bol mozzarella", 2), amount: 150, unit: "gram" },
            ],
          },
          { userId }
        )
      );

      expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
        {
          ingredientName: "rol bladerdeeg",
          amount: 1,
          unit: "",
          ingredientId: pastry.ingredientId,
        },
        {
          ingredientName: "krop ijsbergsla",
          amount: 0.25,
          unit: "",
          ingredientId: lettuce.ingredientId,
        },
        { ingredientName: "bol mozzarella", amount: 150, unit: "gram" },
      ]);
      // Read past, never learned: the text is no spelling of the food.
      await expect(findIngredientFor("rol bladerdeeg")).resolves.toBeNull();
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

  describe("a line joining foods", () => {
    /** A food Norish knows, spelled in a language. */
    async function food(text: string, locale: string | null) {
      return (await mintTestFood(text, { locale })).ingredientId;
    }

    /** Save a recipe with these line texts and answer its lines as read back. */
    async function saved(texts: string[], recipeId = crypto.randomUUID()) {
      const payload = {
        name: "Stew",
        systemUsed: "metric" as const,
        recipeIngredients: texts.map((ingredientName, order) => ({
          ingredientId: null,
          ingredientName,
          amount: 2,
          unit: null,
          order,
        })),
      };

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(payload, { userId })
      );

      return (await getRecipeFull(recipeId))!.recipeIngredients;
    }

    it("points a line at each food its words join, together or as alternatives, keeping its text", async () => {
      const zout = await food("zout", "nl");
      const peper = await food("peper", "nl");
      const boter = await food("boter", "nl");
      const olie = await food("Olie", "da");
      const water = await food("water", "en");
      const kokosmelk = await food("kokosmelk", "nb");
      const kaas = await food("Parmezaanse kaas", "nl");
      const pijnboompitten = await food("pijnboompitten", "nl");

      expect(
        await saved([
          "zout en peper",
          "boter of olie",
          "water of kokosmelk",
          "parmezaanse kaas en/of pijnboompitten",
        ])
      ).toMatchObject([
        {
          ingredientName: "zout en peper",
          ingredientId: zout,
          joined: "together",
          foods: [
            { ingredientId: zout, name: "zout" },
            { ingredientId: peper, name: "peper" },
          ],
        },
        {
          ingredientName: "boter of olie",
          joined: "alternatives",
          foods: [
            { ingredientId: boter, name: "boter" },
            { ingredientId: olie, name: "Olie" },
          ],
        },
        {
          joined: "alternatives",
          foods: [{ ingredientId: water }, { ingredientId: kokosmelk }],
        },
        {
          joined: "alternatives",
          foods: [{ ingredientId: kaas }, { ingredientId: pijnboompitten }],
        },
      ]);
    });

    it("keeps one food for a name known whole, an English of, a part no food and a part not known", async () => {
      const macAndCheese = await food("mac and cheese", "en");
      const parts = [
        await food("mac", "en"),
        await food("cheese", "en"),
        await food("juice", "en"),
        await food("lemon", "en"),
        await food("arugula", "en"),
        await food("passionfruit", "en"),
      ];

      const lines = await saved([
        "mac and cheese",
        "juice of a lemon",
        "juice of lemon",
        "handful of arugula",
        "Arla Skyr Peach & Passionfruit",
      ]);

      expect(lines.map((line) => line.joined)).toEqual([null, null, null, null, null]);
      expect(lines[0]?.ingredientId).toBe(macAndCheese);
      expect(lines[3]?.ingredientId).toBe(parts[4]);
      for (const line of [lines[1], lines[2], lines[4]]) {
        expect(parts).not.toContain(line?.ingredientId);
      }
    });

    it("splits at of where a part's language is not known, as a household's own spelling's is not", async () => {
      const basil = await food("verse basilicum", null);
      const rocket = await food("rucola", "en");

      expect(await saved(["verse basilicum of rucola"])).toMatchObject([
        {
          joined: "alternatives",
          foods: [{ ingredientId: basil }, { ingredientId: rocket }],
        },
      ]);
    });

    it("reads the shorter part with the words the parts share, where that reading is known", async () => {
      for (const text of ["cherry", "grape", "chicken", "vegetable", "salt"]) {
        await food(text, "en");
      }
      const sunflower = await food("zonnebloem", "nl");
      const cherryTomato = await food("cherry tomato", "en");
      const grapeTomato = await food("grape tomatoes", "en");
      const chickenBroth = await food("chicken stock", "en");
      const vegetableBroth = await food("vegetable stock", "en");
      const breast = await food("chicken breast", "en");
      const thigh = await food("chicken thigh", "en");
      const pepper = await food("black pepper", "en");
      const coconutOil = await food("kokosolie", "nl");
      const redCabbage = await food("rode kool", "nl");
      const whiteCabbage = await food("witte kool", "nl");

      await food("rode", "nl");
      const lines = await saved([
        "cherry or grape tomatoes",
        "chicken or vegetable stock",
        "chicken breast or thigh",
        "salt and black pepper",
        "zonnebloem- of kokosolie",
        "rode- en witte kool",
      ]);

      expect(lines).toMatchObject([
        { foods: [{ ingredientId: cherryTomato }, { ingredientId: grapeTomato }] },
        { foods: [{ ingredientId: chickenBroth }, { ingredientId: vegetableBroth }] },
        { foods: [{ ingredientId: breast }, { ingredientId: thigh }] },
        { foods: [{ name: "salt" }, { ingredientId: pepper }] },
        { joined: null, foods: [{}] },
        { foods: [{ ingredientId: redCabbage }, { ingredientId: whiteCabbage }] },
      ]);
      expect([sunflower, coconutOil]).not.toContain(lines[4]?.ingredientId);
    });

    it("borrows no words between foods joined together: garlic and olive oil is not garlic oil", async () => {
      const garlic = await food("garlic", "en");
      const oliveOil = await food("olive oil", "en");

      await food("garlic oil", "en");
      const [line] = await saved(["garlic and olive oil"]);

      expect(line).toMatchObject({
        foods: [{ ingredientId: garlic }, { ingredientId: oliveOil }],
      });
    });

    it("names one food where every part is a spelling of it", async () => {
      const [row] = await mintIngredientWithAliases({
        name: "spring onion",
        aliases: [
          { text: "spring onions", fold: ingredientAliasFold("spring onions") },
          { text: "scallions", fold: ingredientAliasFold("scallions") },
        ],
        ownerId: null,
        locale: "en",
        flagged: false,
      });

      expect(await saved(["spring onions or scallions"])).toMatchObject([
        { ingredientId: row!.ingredientId, joined: null },
      ]);
    });

    it("splits at the administrator's joining words, and keeps a saved line's foods while its text is", async () => {
      const zout = await food("zout", "nl");
      const peper = await food("peper", "nl");
      await food("boter", "nl");
      await food("olie", "nl");
      const recipeId = crypto.randomUUID();
      const [line] = await saved(["zout en peper"], recipeId);

      await setConfig(
        ServerConfigKeys.INGREDIENT_WORDS,
        { words: { nl: { together: [], alternatives: ["en/of"] } }, isOverridden: true },
        null,
        false
      );
      forgetSpellingRules();
      try {
        expect(await saved(["boter of olie", "boter en/of olie"])).toMatchObject([
          { joined: null },
          { joined: "alternatives" },
        ]);

        await updateRecipeWithRefs(
          recipeId,
          userId,
          await withResolvedIngredients(
            {
              systemUsed: "metric",
              recipeIngredients: [
                {
                  id: line!.id,
                  ingredientId: zout,
                  ingredientName: "zout en peper",
                  amount: 2,
                  unit: null,
                  order: 0,
                },
              ],
            },
            { userId },
            recipeId
          )
        );
        expect((await getRecipeFull(recipeId))?.recipeIngredients).toMatchObject([
          { joined: "together", foods: [{ ingredientId: zout }, { ingredientId: peper }] },
        ]);
      } finally {
        await setConfig(
          ServerConfigKeys.INGREDIENT_WORDS,
          { words: DEFAULT_INGREDIENT_WORDS, isOverridden: false },
          null,
          false
        );
        forgetSpellingRules();
      }
    });
  });

  describe("the junk pile", () => {
    async function pile(...texts: string[]) {
      await withTransaction((tx) =>
        addToJunkPile(tx, texts.map(ingredientAliasFold), { reason: "seed" })
      );
      forgetSpellingRules();
    }

    async function lines(texts: string[]) {
      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        userId,
        await withResolvedIngredients(
          {
            name: "Chicken",
            systemUsed: "metric",
            recipeIngredients: texts.map((ingredientName, order) => ({
              ingredientId: null,
              ingredientName,
              amount: 1,
              unit: null,
              order,
            })),
          },
          { userId }
        )
      );

      return (await getRecipeFull(recipeId))!.recipeIngredients;
    }

    it("drops a comma piece on the pile and reads the text on the rest; all on it, the text names no food", async () => {
      const breasts = await mintTestFood("skinless chicken breasts");
      const zout = await mintTestFood("zout");

      await pile("boneless", "to taste");
      const minted: string[] = [];

      onIngredientsMinted(async (ids) => void minted.push(...ids));
      try {
        expect(
          await lines([
            "boneless, skinless chicken breasts",
            "boneless",
            "lbs boneless",
            "zout en boneless",
            "boneless, to taste",
          ])
        ).toMatchObject([
          {
            ingredientName: "boneless, skinless chicken breasts",
            ingredientId: breasts.ingredientId,
          },
          { ingredientName: "boneless", ingredientId: null },
          { ingredientName: "lbs boneless", ingredientId: null },
          { ingredientName: "zout en boneless", ingredientId: zout.ingredientId, joined: null },
          { ingredientName: "boneless, to taste", ingredientId: null },
        ]);
      } finally {
        onIngredientsMinted(undefined);
      }
      expect(minted).toEqual([]);
      await expect(getTestDb().select().from(ingredients)).resolves.toHaveLength(2);
    });

    it("reads the parts a joining word leaves once one is dropped, each joining word with its parts", async () => {
      const salt = await mintTestFood("salt", { locale: "en" });
      const pepper = await mintTestFood("pepper", { locale: "en" });

      await pile("boneless");
      const [unknown, middle] = await lines([
        "boneless and skinless chicken",
        "boneless of salt or pepper",
      ]);
      const [minted] = await getTestDb()
        .select({ name: ingredients.name })
        .from(ingredients)
        .where(eq(ingredients.id, unknown!.ingredientId!));

      expect(minted?.name).toBe("skinless chicken");
      // English "of" joins a measure, so read beside "salt" and "pepper" it would split nothing.
      expect(middle).toMatchObject({
        joined: "alternatives",
        foods: [{ ingredientId: salt.ingredientId }, { ingredientId: pepper.ingredientId }],
      });
    });

    it("keeps a typed grocery on the pile, naming no food", async () => {
      await pile("boneless");

      await expect(resolveGroceryNames([{ name: "boneless" }], { userId })).resolves.toEqual([
        null,
      ]);
      await expect(getTestDb().select().from(ingredients)).resolves.toHaveLength(0);
    });
  });
});
