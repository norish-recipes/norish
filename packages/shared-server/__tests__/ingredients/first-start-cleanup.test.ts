// @vitest-environment node
/**
 * The cleanup the first start of the release runs, against a real database, on a scenario
 * modelled on the production data: seeded stray marks, "gyoza vellen )" and "gyoza vellen
 * ((ontdooid))", "zout en peper" kept distinct, and an undecided own food for the AI pass. It runs
 * once.
 */
import { asc, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { withTransaction } from "@norish/db/drizzle";
import {
  addIngredientAliases,
  mintIngredientWithAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { addToJunkPile } from "@norish/db/repositories/ingredient-junk-pile";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
import {
  groceries,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recurringGroceries,
  serverConfig,
} from "@norish/db/schema";
import { parentByAI } from "@norish/shared-server/ingredients/ai-changes";
import { markDistinct, setParent } from "@norish/shared-server/ingredients/catalogue";
import { forgetSpellingRules } from "@norish/shared-server/ingredients/resolver";
import { updateIngredientSeedState } from "@norish/shared-server/ingredients/seed/catalogue-seed";
import {
  CLEANUP_VERSION,
  cleanUpCatalogueOnFirstStart,
} from "@norish/shared-server/ingredients/seed/first-start-cleanup";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import {
  createTestRecipe,
  getRecipeIngredients,
  getSpellingTexts,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { seedEntry } from "../helpers/seed-entries";

describe("the first-start cleanup", () => {
  const testBase = new RepositoryTestBase("test_first_start_cleanup");

  let userId: string;
  let seeded: Map<string, string>;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    await getTestDb()
      .delete(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
    await applyIngredientSeed([
      seedEntry("en:honey", "honey", "3wu)"),
      seedEntry("en:bell-pepper", "bell pepper", "paprika (vrucht)"),
      seedEntry("en:salt", "salt", "zout", "Salz"),
      seedEntry("en:pepper", "pepper", "peper", "Pfeffer"),
      seedEntry("en:lettuce", "lettuce", "sla"),
    ]);
    seeded = await listSeededIngredientIds();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** An own food as earlier versions minted it: its name and every text as written a spelling. */
  async function oldMint(name: string, texts: string[]) {
    const rows = await mintIngredientWithAliases({
      name,
      aliases: texts.map((text) => ({ text, fold: ingredientAliasFold(text) })),
      ownerId: userId,
      locale: null,
      flagged: true,
      flagReason: "upgrade",
    });

    return { ingredientId: rows[0]!.ingredientId, aliasIds: rows.map((row) => row.aliasId) };
  }

  /** The spellings a line names, in order. */
  async function lineSpellings(lineId: string) {
    const rows = await getTestDb()
      .select({ text: ingredientAliases.text })
      .from(recipeIngredientFoods)
      .innerJoin(
        ingredientAliases,
        eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId)
      )
      .where(eq(recipeIngredientFoods.recipeIngredientId, lineId))
      .orderBy(asc(recipeIngredientFoods.position));

    return rows.map((row) => row.text);
  }

  async function exists(ingredientId: string) {
    const rows = await getTestDb()
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, ingredientId));

    return rows.length > 0;
  }

  it("cleans the catalogue earlier versions left, step by step", async () => {
    const db = getTestDb();
    const recipe = await createTestRecipe(userId);
    const gyoza = await oldMint("gyoza vellen ((ontdooid))", [
      "gyoza vellen ((ontdooid))",
      "gyoza vellen )",
    ]);
    const gyozaLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "gyoza vellen ((ontdooid))", amount: "12", order: "0" },
      [gyoza.aliasIds[0]!]
    );

    await db.insert(groceries).values({
      userId,
      name: "gyoza vellen ((ontdooid))",
      ingredientAliasId: gyoza.aliasIds[0]!,
      ingredientId: gyoza.ingredientId,
    });

    const joined = await oldMint("zout en peper", ["zout en peper"]);
    const joinedPointers = {
      ingredientAliasId: joined.aliasIds[0]!,
      ingredientId: joined.ingredientId,
    };

    await markDistinct(
      { userId, householdUserIds: null, isServerAdmin: false },
      joined.ingredientId
    );
    const joinedLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "zout en peper", order: "1" },
      [joined.aliasIds[0]!]
    );

    await db.insert(pantryIngredients).values({ userId, ...joinedPointers });
    await db.insert(recurringGroceries).values({
      userId,
      name: "zout en peper",
      ...joinedPointers,
      recurrenceRule: "week",
      nextPlannedFor: "2027-01-01",
    });

    const undecided = await oldMint("kokosbloesemsuiker", ["kokosbloesemsuiker"]);
    const decided = await oldMint("palmsuiker", ["palmsuiker"]);
    // A grocery food: only a Grocery names it, so AI leaves it.
    const reserve = await oldMint("Nora reserve eten", ["Nora reserve eten"]);

    await insertTestRecipeLine({ recipeId: recipe.id, name: "kokosbloesemsuiker", order: "2" }, [
      undecided.aliasIds[0]!,
    ]);
    await db.insert(groceries).values({
      userId,
      name: "Nora reserve eten",
      ingredientAliasId: reserve.aliasIds[0]!,
      ingredientId: reserve.ingredientId,
    });

    await markDistinct(
      { userId, householdUserIds: null, isServerAdmin: false },
      decided.ingredientId
    );

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toEqual({
      seeded: 1,
      cleaned: 1,
      removed: 1,
      cleared: 0,
      split: 1,
      renamed: 1,
      // The grocery food's "upgrade" flag.
      unflagged: 1,
      unmarked: 0,
      retired: 0,
      reread: 0,
      deleted: 0,
    });

    // 1. Seeded stray marks go; balanced brackets stay.
    expect((await getSpellingTexts(seeded.get("en:honey")!)).sort()).toEqual(["3wu", "honey"]);
    expect((await getSpellingTexts(seeded.get("en:bell-pepper")!)).sort()).toEqual([
      "bell pepper",
      "paprika (vrucht)",
    ]);

    // 2 and 3. One spelling, on the same food, named for it; its line and grocery point at it.
    expect(await getSpellingTexts(gyoza.ingredientId)).toEqual(["gyoza vellen"]);
    await expect(
      db
        .select({ name: ingredients.name })
        .from(ingredients)
        .where(eq(ingredients.id, gyoza.ingredientId))
    ).resolves.toEqual([{ name: "gyoza vellen" }]);
    expect(await lineSpellings(gyozaLine.id)).toEqual(["gyoza vellen"]);
    await expect(
      db
        .select({ alias: groceries.ingredientAliasId, food: groceries.ingredientId })
        .from(groceries)
        .where(eq(groceries.ingredientId, gyoza.ingredientId))
    ).resolves.toEqual([{ alias: gyoza.aliasIds[1], food: gyoza.ingredientId }]);
    const gyozaFoods = (await db.select({ name: ingredients.name }).from(ingredients)).filter(
      (row) => row.name.includes("gyoza")
    );

    expect(gyozaFoods).toHaveLength(1);

    // 5. The joined food is split and removed, though a person kept it distinct.
    expect(await exists(joined.ingredientId)).toBe(false);
    expect(await lineSpellings(joinedLine.id)).toEqual(["zout", "peper"]);
    await expect(
      db.select({ food: pantryIngredients.ingredientId }).from(pantryIngredients)
    ).resolves.toEqual(
      expect.arrayContaining([{ food: seeded.get("en:salt") }, { food: seeded.get("en:pepper") }])
    );
    await expect(
      db
        .select({ name: recurringGroceries.name, food: recurringGroceries.ingredientId })
        .from(recurringGroceries)
        .orderBy(asc(recurringGroceries.name))
    ).resolves.toEqual([
      { name: "peper", food: seeded.get("en:pepper") },
      { name: "zout", food: seeded.get("en:salt") },
    ]);
  });

  it.each([
    ["kruidenmix", "zout en peper"],
    ["seasoning", "salt and pepper"],
    ["Gewürzmischung", "Salz und Pfeffer"],
  ])(
    "keeps %s, a food a person merged %s into: only a joined name splits",
    async (mix, joinedText) => {
      const food = await oldMint(mix, [mix, joinedText]);
      const recipe = await createTestRecipe(userId);
      const mixLine = await insertTestRecipeLine({ recipeId: recipe.id, name: mix, order: "0" }, [
        food.aliasIds[0]!,
      ]);
      const joinedLine = await insertTestRecipeLine(
        { recipeId: recipe.id, name: joinedText, order: "1" },
        [food.aliasIds[1]!]
      );

      await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ split: 0 });
      expect(await exists(food.ingredientId)).toBe(true);
      expect(await lineSpellings(mixLine.id)).toEqual([mix]);
      expect(await lineSpellings(joinedLine.id)).toEqual([joinedText]);
    }
  );

  it("splits a joined food keeping the word its parts share, and leaves one that reading misses", async () => {
    for (const text of ["cherry", "grape", "cherry tomato", "grape tomatoes", "zonnebloem"]) {
      await mintTestFood(text, { locale: "en" });
    }
    await mintTestFood("kokosolie", { locale: "nl" });
    const tomatoes = await oldMint("cherry or grape tomatoes", ["cherry or grape tomatoes"]);
    const oils = await oldMint("zonnebloem- of kokosolie", ["zonnebloem- of kokosolie"]);
    const recipe = await createTestRecipe(userId);
    const tomatoLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "cherry or grape tomatoes", order: "0" },
      [tomatoes.aliasIds[0]!]
    );

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ split: 1 });
    expect(await exists(tomatoes.ingredientId)).toBe(false);
    expect(await lineSpellings(tomatoLine.id)).toEqual(["cherry tomato", "grape tomatoes"]);
    expect(await exists(oils.ingredientId)).toBe(true);
  });

  it("splits a food an older version minted whole at a slash or a plus", async () => {
    const pair = await oldMint("Salt/pepper", ["Salt/pepper"]);
    const plus = await oldMint("salt + black pepper", ["salt + black pepper"]);

    await mintTestFood("black pepper", { locale: "en" });
    const recipe = await createTestRecipe(userId);
    const pairLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "Salt & pepper", order: "0" },
      [pair.aliasIds[0]!]
    );
    const plusLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "salt + black pepper", order: "1" },
      [plus.aliasIds[0]!]
    );

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ split: 2 });
    expect(await lineSpellings(pairLine.id)).toEqual(["salt", "pepper"]);
    expect(await lineSpellings(plusLine.id)).toEqual(["salt", "black pepper"]);
  });

  it("merges a food named for a known food and a note into it, kept distinct or not", async () => {
    const oil = await mintTestFood("olie", { locale: "nl" });
    const frying = await oldMint("olie om te bakken", ["olie om te bakken"]);
    const kept = await oldMint("zout naar keuze", ["zout naar keuze"]);
    const recipe = await createTestRecipe(userId);
    const fryingLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "olie om te bakken", order: "0" },
      [frying.aliasIds[0]!]
    );
    const keptLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "zout naar keuze", order: "1" },
      [kept.aliasIds[0]!]
    );

    await markDistinct({ userId, householdUserIds: null, isServerAdmin: false }, kept.ingredientId);
    // A parent 0.25 marked as a person's is no decision: its mark goes first.
    await setParent(
      { userId, householdUserIds: null, isServerAdmin: false },
      frying.ingredientId,
      oil.ingredientId
    );
    await cleanUpCatalogueOnFirstStart();

    expect(await exists(frying.ingredientId)).toBe(false);
    expect(await lineSpellings(fryingLine.id)).toEqual(["olie"]);
    expect(await getSpellingTexts(oil.ingredientId)).toEqual(["olie"]);
    expect(await exists(kept.ingredientId)).toBe(false);
    expect(await lineSpellings(keptLine.id)).toEqual(["zout"]);
  });

  it("leaves a food named for a known food and a note whose parent a person chose since 0.25", async () => {
    const oil = await mintTestFood("olie", { locale: "nl" });
    const frying = await oldMint("olie om te bakken", ["olie om te bakken"]);
    const line = await insertTestRecipeLine(
      { recipeId: (await createTestRecipe(userId)).id, name: "olie om te bakken" },
      [frying.aliasIds[0]!]
    );

    await setParent(
      { userId, householdUserIds: null, isServerAdmin: false },
      frying.ingredientId,
      oil.ingredientId
    );
    // Not the first cleanup: no 0.25 marks are cleared.
    await updateIngredientSeedState({ cleanupVersion: CLEANUP_VERSION - 1 });
    await cleanUpCatalogueOnFirstStart();

    expect(await lineSpellings(line.id)).toEqual(["olie om te bakken"]);
    expect(await exists(frying.ingredientId)).toBe(true);
  });

  it("takes an own food from the lines that now name no food, kept distinct or not, and deletes it", async () => {
    const melted = await oldMint("melted", ["melted"]);
    const tin = await oldMint("Bakvorm", ["Bakvorm"]);
    // Nothing names it, but every spelling it has names no food.
    const chopped = await oldMint("chopped", ["chopped"]);
    const toppings = await oldMint("toppings as desired", ["toppings as desired"]);
    const recipe = await createTestRecipe(userId);
    const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "melted", order: "0" }, [
      melted.aliasIds[0]!,
    ]);
    const tinLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "Bakvorm met opstaande randen, ca 24 x 34", order: "1" },
      [tin.aliasIds[0]!]
    );
    const toppingsLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "toppings as desired", order: "2" },
      [toppings.aliasIds[0]!]
    );

    await markDistinct(
      { userId, householdUserIds: null, isServerAdmin: false },
      melted.ingredientId
    );
    await withTransaction((tx) =>
      addToJunkPile(tx, ["melted", "bakvorm", "chopped", "toppings"], { reason: "seed" })
    );
    forgetSpellingRules();

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ reread: 3, deleted: 4 });
    expect(await lineSpellings(line.id)).toEqual([]);
    expect(await lineSpellings(tinLine.id)).toEqual([]);
    expect(await lineSpellings(toppingsLine.id)).toEqual([]);
    for (const food of [melted, tin, chopped, toppings]) {
      expect(await exists(food.ingredientId)).toBe(false);
    }
  });

  it("reads every line again, writing only those that read other foods now", async () => {
    const spelled = async (fold: string) =>
      (
        await getTestDb()
          .select({ id: ingredientAliases.id })
          .from(ingredientAliases)
          .where(eq(ingredientAliases.fold, fold))
      )[0]!.id;
    const recipe = await createTestRecipe(userId);
    // An earlier version read a comma list as its first piece.
    const list = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "peper, zout", order: "0" },
      [await spelled("peper")]
    );
    const same = await insertTestRecipeLine({ recipeId: recipe.id, name: "zout", order: "1" }, [
      await spelled("zout"),
    ]);
    const version = async (id: string) =>
      (
        await getTestDb()
          .select({ version: recipeIngredients.version })
          .from(recipeIngredients)
          .where(eq(recipeIngredients.id, id))
      )[0]!.version;
    const sameBefore = await version(same.id);

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ reread: 1 });
    expect(await lineSpellings(list.id)).toEqual(["peper", "zout"]);
    expect(await version(same.id)).toBe(sameBefore);
  });

  it("leaves a joined food whose whole name another food spells, as a line would read it", async () => {
    await mintIngredientWithAliases({
      name: "salt and pepper",
      aliases: [{ text: "zout en peper", fold: ingredientAliasFold("zout en peper") }],
      ownerId: userId,
      locale: "nl",
      flagged: false,
    });
    const joined = await oldMint("zout en peper", ["peper en zout"]);
    const line = await insertTestRecipeLine(
      { recipeId: (await createTestRecipe(userId)).id, name: "peper en zout" },
      joined.aliasIds
    );

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({
      split: 0,
      renamed: 0,
      removed: 0,
    });
    expect(await exists(joined.ingredientId)).toBe(true);
    expect(await lineSpellings(line.id)).toEqual(["peper en zout"]);
  });

  it("neither splits nor renames a hidden food", async () => {
    const joined = await oldMint("zout en peper", ["zout en peper"]);
    const dirty = await oldMint("baking soda )", ["baking soda"]);

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({
      split: 0,
      renamed: 0,
    });
    expect(await exists(joined.ingredientId)).toBe(true);
    await expect(
      getTestDb()
        .select({ name: ingredients.name })
        .from(ingredients)
        .where(eq(ingredients.id, dirty.ingredientId))
    ).resolves.toEqual([{ name: "baking soda )" }]);
  });

  it("leaves a spelling on the junk pile to AI's spelling check", async () => {
    const [boneless] = (await addIngredientAliases({
      ingredientId: seeded.get("en:salt")!,
      aliases: [{ text: "boneless", fold: "boneless" }],
      ownerId: userId,
      locale: null,
    }))!;
    const line = await insertTestRecipeLine(
      { recipeId: (await createTestRecipe(userId)).id, name: "boneless" },
      [boneless!.aliasId]
    );

    await withTransaction((tx) => addToJunkPile(tx, ["boneless"], { reason: "seed" }));
    forgetSpellingRules();

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ removed: 0 });
    expect(await lineSpellings(line.id)).toEqual(["boneless"]);
  });

  it("runs once: a second start does nothing", async () => {
    await oldMint("baking soda )", ["baking soda )"]);

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ cleaned: 1 });
    await oldMint("cooked pasta of choice )", ["cooked pasta of choice )"]);

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toBeNull();
    const [left] = await getTestDb()
      .select({ text: ingredientAliases.text })
      .from(ingredientAliases)
      .where(eq(ingredientAliases.fold, ingredientAliasFold("cooked pasta of choice )")));

    expect(left).toEqual({ text: "cooked pasta of choice )" });
  });

  it("keeps the name a person gave a food, cleaning only its spelling", async () => {
    const named = await oldMint("Gyoza (ontdooid)", ["Gyoza (ontdooid) )"]);

    await insertTestRecipeLine(
      { recipeId: (await createTestRecipe(userId)).id, name: "Gyoza (ontdooid) )" },
      named.aliasIds
    );
    await getTestDb()
      .update(ingredients)
      .set({ nameChosen: true })
      .where(eq(ingredients.id, named.ingredientId));

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ renamed: 0 });
    await expect(
      getTestDb()
        .select({ name: ingredients.name })
        .from(ingredients)
        .where(eq(ingredients.id, named.ingredientId))
    ).resolves.toEqual([{ name: "Gyoza (ontdooid)" }]);
  });

  it("joins a food whose one spelling's clean name another food has, and its rows follow", async () => {
    const legacy = await oldMint("zout naar smaak", ["zout naar smaak"]);
    const recipe = await createTestRecipe(userId);
    const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "zout naar smaak" }, [
      legacy.aliasIds[0]!,
    ]);

    await markDistinct(
      { userId, householdUserIds: null, isServerAdmin: false },
      legacy.ingredientId
    );

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ removed: 1 });
    expect(await exists(legacy.ingredientId)).toBe(false);
    expect(await lineSpellings(line.id)).toEqual(["zout"]);
  });

  it("cleans the spellings an old import's null or a weight left, and their lines follow", async () => {
    const nulled = await oldMint("null zout", ["null zout"]);
    const weighed = await oldMint("kilo krieltjes", ["kilo krieltjes"]);
    const recipe = await createTestRecipe(userId);
    const salt = await insertTestRecipeLine({ recipeId: recipe.id, name: "null zout" }, [
      nulled.aliasIds[0]!,
    ]);
    const potatoes = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "kilo krieltjes", amount: "1", order: "1" },
      [weighed.aliasIds[0]!]
    );

    await cleanUpCatalogueOnFirstStart();
    expect(await exists(nulled.ingredientId)).toBe(false);
    expect(await lineSpellings(salt.id)).toEqual(["zout"]);
    expect(await lineSpellings(potatoes.id)).toEqual(["krieltjes"]);
  });

  it("keeps the flag of the food a variant joins, as no one decided that merge", async () => {
    const mint = await oldMint("kokosbloesemsuiker", ["kokosbloesemsuiker"]);
    const variant = await oldMint("kokosbloesemsuiker naar smaak", [
      "kokosbloesemsuiker naar smaak",
    ]);
    const recipe = await createTestRecipe(userId);

    await insertTestRecipeLine({ recipeId: recipe.id, name: "kokosbloesemsuiker" }, [
      mint.aliasIds[0]!,
    ]);
    await getTestDb()
      .update(ingredients)
      .set({ flagReason: "ai-unsure" })
      .where(eq(ingredients.id, mint.ingredientId));

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ removed: 1 });
    expect(await exists(variant.ingredientId)).toBe(false);
    await expect(
      getTestDb()
        .select({ flagged: ingredients.flagged, reason: ingredients.flagReason })
        .from(ingredients)
        .where(eq(ingredients.id, mint.ingredientId))
    ).resolves.toEqual([{ flagged: true, reason: "ai-unsure" }]);
  });

  it("deletes a food whose one spelling names nothing; its grocery keeps its text", async () => {
    const junk = await oldMint(")", [")"]);

    await getTestDb().insert(groceries).values({
      userId,
      name: ")",
      ingredientAliasId: junk.aliasIds[0]!,
      ingredientId: junk.ingredientId,
    });

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ removed: 1 });
    expect(await exists(junk.ingredientId)).toBe(false);
    await expect(
      getTestDb().select({ name: groceries.name, food: groceries.ingredientId }).from(groceries)
    ).resolves.toEqual([{ name: ")", food: null }]);
  });

  it("takes the food from a line naming none, though it names a clean spelling; the line keeps its text", async () => {
    const peri = await oldMint("peri peri kruiden", ["peri peri kruiden"]);
    const recipe = await createTestRecipe(userId);
    const heading = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "Peri peri kruiden:", order: "0" },
      [peri.aliasIds[0]!]
    );
    const measured = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "peri peri kruiden", amount: "1", order: "1" },
      [peri.aliasIds[0]!]
    );

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ cleared: 1 });
    expect(await lineSpellings(heading.id)).toEqual([]);
    expect(await lineSpellings(measured.id)).toEqual(["peri peri kruiden"]);
    expect((await getRecipeIngredients(recipe.id)).map((line) => line.name).sort()).toEqual([
      "Peri peri kruiden:",
      "peri peri kruiden",
    ]);
  });

  it("clears the flag of a hidden food, but keeps a listed food's", async () => {
    const reserve = await oldMint("Nora reserve eten", ["Nora reserve eten"]);
    const queued = await oldMint("Nora brokken", ["Nora brokken"]);
    const listed = await oldMint("kokosbloesemsuiker", ["kokosbloesemsuiker"]);
    const recipe = await createTestRecipe(userId);

    await insertTestRecipeLine({ recipeId: recipe.id, name: "kokosbloesemsuiker" }, [
      listed.aliasIds[0]!,
    ]);
    for (const [food, flagReason] of [
      [reserve, "ai-unsure"],
      [queued, "ai-queued"],
      [listed, "ai-unsure"],
    ] as const) {
      await getTestDb()
        .update(ingredients)
        .set({ flagReason })
        .where(eq(ingredients.id, food.ingredientId));
    }

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ unflagged: 2 });
    const flags = await getTestDb()
      .select({
        name: ingredients.name,
        flagged: ingredients.flagged,
        reason: ingredients.flagReason,
      })
      .from(ingredients)
      .where(isNull(ingredients.offId));

    expect(flags.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "kokosbloesemsuiker", flagged: true, reason: "ai-unsure" },
      { name: "Nora brokken", flagged: false, reason: null },
      { name: "Nora reserve eten", flagged: false, reason: null },
    ]);
  });

  it("lifts every flag that said AI was waiting, off or failing, keeping AI's doubt under an open change", async () => {
    const recipe = await createTestRecipe(userId);

    for (const [name, flagReason] of [
      ["kokosbloesemsuiker", "ai-queued"],
      ["palmsuiker", "ai-off"],
      ["rietsuiker", "ai-unavailable"],
      ["basterdsuiker", "ai-key-rejected"],
      ["kandijsuiker", "ai-unavailable"],
    ] as const) {
      const food = await oldMint(name, [name]);

      await insertTestRecipeLine({ recipeId: recipe.id, name }, [food.aliasIds[0]!]);
      // An unsure parent is an open change; a flag kept its unanswered reason under one.
      if (name === "kandijsuiker")
        await parentByAI(food.ingredientId, seeded.get("en:salt")!, false);
      await getTestDb()
        .update(ingredients)
        .set({ flagged: true, flagReason })
        .where(eq(ingredients.id, food.ingredientId));
    }

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({ retired: 5 });
    const flags = await getTestDb()
      .select({
        name: ingredients.name,
        flagged: ingredients.flagged,
        reason: ingredients.flagReason,
      })
      .from(ingredients)
      .where(isNull(ingredients.offId));

    expect(flags.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "basterdsuiker", flagged: false, reason: null },
      { name: "kandijsuiker", flagged: true, reason: "ai-unsure" },
      { name: "kokosbloesemsuiker", flagged: false, reason: null },
      { name: "palmsuiker", flagged: false, reason: null },
      { name: "rietsuiker", flagged: false, reason: null },
    ]);
  });

  it("removes a spelling ending in a colon, so its line names no food and keeps its text", async () => {
    const lettuce = seeded.get("en:lettuce")!;
    const [colon] = (await addIngredientAliases({
      ingredientId: lettuce,
      aliases: [{ text: "Voor de salade:", fold: ingredientAliasFold("Voor de salade:") }],
      ownerId: userId,
      locale: null,
    }))!;
    const own = await oldMint("Voor het beslag:", ["Voor het beslag:"]);
    const recipe = await createTestRecipe(userId);
    const saladLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "Voor de salade:", order: "0" },
      [colon!.aliasId]
    );
    const batterLine = await insertTestRecipeLine(
      { recipeId: recipe.id, name: "Voor het beslag:", order: "1" },
      [own.aliasIds[0]!]
    );

    await getTestDb().insert(groceries).values({
      userId,
      name: "Voor de salade:",
      ingredientAliasId: colon!.aliasId,
      ingredientId: lettuce,
    });

    await expect(cleanUpCatalogueOnFirstStart()).resolves.toMatchObject({
      cleaned: 0,
      removed: 2,
    });
    expect((await getSpellingTexts(lettuce)).sort()).toEqual(["lettuce", "sla"]);
    expect(await exists(own.ingredientId)).toBe(false);
    expect(await lineSpellings(saladLine.id)).toEqual([]);
    expect(await lineSpellings(batterLine.id)).toEqual([]);
    expect((await getRecipeIngredients(recipe.id)).map((line) => line.name).sort()).toEqual([
      "Voor de salade:",
      "Voor het beslag:",
    ]);
    // A grocery keeps a food, as a new one of that text would: its own, minted from the clean text.
    await expect(
      getTestDb()
        .select({ name: groceries.name, food: ingredients.name })
        .from(groceries)
        .innerJoin(ingredients, eq(ingredients.id, groceries.ingredientId))
    ).resolves.toEqual([{ name: "Voor de salade:", food: "Voor de salade" }]);
  });

  it("lets AI ask about and re-file a food whose parent was confirmed in 0.25, not one chosen since", async () => {
    const actor = { userId, householdUserIds: null, isServerAdmin: false };
    const prawns = await oldMint("king prawns", ["king prawns"]);
    const recipe = await createTestRecipe(userId);
    const parentOf = async () =>
      (
        await getTestDb()
          .select({ parentId: ingredients.parentId })
          .from(ingredients)
          .where(eq(ingredients.id, prawns.ingredientId))
      )[0]?.parentId;

    await insertTestRecipeLine({ recipeId: recipe.id, name: "king prawns" }, [prawns.aliasIds[0]!]);
    // 0.25 marked a confirmed suggestion as a person's parent.
    await setParent(actor, prawns.ingredientId, seeded.get("en:honey")!);

    await cleanUpCatalogueOnFirstStart();
    await expect(parentByAI(prawns.ingredientId, seeded.get("en:salt")!, true)).resolves.toEqual(
      expect.objectContaining({ outcome: "applied" })
    );
    expect(await parentOf()).toBe(seeded.get("en:salt"));

    // A parent a person chooses after the upgrade keeps AI away, through a later release's cleanup.
    await setParent(actor, prawns.ingredientId, seeded.get("en:pepper")!);
    await updateIngredientSeedState({ cleanupVersion: CLEANUP_VERSION + 1 });
    await cleanUpCatalogueOnFirstStart();
    await expect(parentByAI(prawns.ingredientId, seeded.get("en:salt")!, true)).resolves.toEqual(
      expect.objectContaining({ outcome: "decided" })
    );
    expect(await parentOf()).toBe(seeded.get("en:pepper"));
  });
});
