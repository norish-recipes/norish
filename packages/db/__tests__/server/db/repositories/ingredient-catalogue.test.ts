// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { withTransaction } from "@norish/db/drizzle";
import {
  countIngredientUses,
  countListedIngredients,
  deleteCatalogueAlias,
  forEachCatalogue,
  keepIngredientDistinct,
  listCatalogueIngredients,
  listIngredientRecipes,
  listIngredientUses,
  renameCatalogueIngredient,
} from "@norish/db/repositories/ingredient-catalogue";
import { setIngredientIcon } from "@norish/db/repositories/ingredient-icons";
import { insertSeededIngredient } from "@norish/db/repositories/ingredient-seed";
import * as schema from "@norish/db/schema";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";

import {
  createTestIngredient,
  createTestRecipe,
  createTestRecipeIngredients,
  createTestUser,
  firstSpellingId,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
  readTestIngredient,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
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

  let household: string;

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    household = testHouseholdOf(user.id);
    const db = getTestDb();
    const [onion] = await db
      .insert(schema.ingredients)
      .values({ householdId: household, name: "Onion", createdAt: new Date() })
      .returning();
    const [redOnion] = await db
      .insert(schema.ingredients)
      .values({
        householdId: household,
        name: "Red onion",
        parentId: onion!.id,
        createdAt: new Date(),
      })
      .returning();

    await db
      .insert(schema.ingredients)
      .values({ householdId: household, name: "Chocolate", createdAt: new Date() });
    await db.insert(schema.ingredientAliases).values([
      { householdId: household, text: "Onion", fold: "onion", ingredientId: onion!.id },
      { householdId: household, text: "Ui", fold: "ui", locale: "nl", ingredientId: onion!.id },
      { householdId: household, text: "Red onion", fold: "red onion", ingredientId: redOnion!.id },
    ]);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const names = async (
    search: ReturnType<typeof parseIngredientSearch>,
    languages: readonly string[] = ["en"]
  ) =>
    (
      await listCatalogueIngredients({
        householdId: household,
        search,
        languages,
        flaggedOnly: false,
        limit: 10,
        offset: 0,
      })
    ).map((row) => row.name);

  it("finds the text anywhere in a name, the exact name first", async () => {
    expect(await names(parseIngredientSearch("onion"))).toEqual(["Onion", "Red onion"]);
  });

  it("puts the foods with a word starting with the text before those that only contain it", async () => {
    await getTestDb()
      .insert(schema.ingredients)
      .values(
        ["Alcohol", "Honey", "Hot sauce", "Red hot chili", "Ahoy"].map((name) => ({
          householdId: household,
          name,
          createdAt: new Date(),
        }))
      );

    expect(await names(parseIngredientSearch("ho"))).toEqual([
      "Honey",
      "Hot sauce",
      "Red hot chili",
      "Ahoy",
      "Alcohol",
      "Chocolate",
    ]);
  });

  it("finds a name with every typed word in it, in any order", async () => {
    await getTestDb()
      .insert(schema.ingredients)
      .values(
        ["Extra virgin olive oil", "Olive", "Sunflower oil"].map((name) => ({
          householdId: household,
          name,
          createdAt: new Date(),
        }))
      );

    expect(await names(parseIngredientSearch("olive ex"))).toEqual(["Extra virgin olive oil"]);
    expect(await names(parseIngredientSearch("oil olive"))).toEqual(["Extra virgin olive oil"]);
    expect(await names(parseIngredientSearch("  oil   ex  "))).toEqual(["Extra virgin olive oil"]);
    expect(await names(parseIngredientSearch("oil"))).toEqual([
      "Extra virgin olive oil",
      "Sunflower oil",
    ]);
    expect(await names(parseIngredientSearch("olive xyz"))).toEqual([]);
  });

  it("matches a word's % _ and backslash as written, never as a pattern", async () => {
    const search = parseIngredientSearch("onion")!;

    for (const word of ["o%n", "o_ion", "on\\ion"]) {
      expect(await names({ ...search, fold: word, words: [word] })).toEqual([]);
    }
    expect(await names(parseIngredientSearch("oni%on_"))).toEqual(["Onion", "Red onion"]);
  });

  it("ranks a word start in the folded name, a translation in the reader's language or after a hyphen", async () => {
    const db = getTestDb();
    const [garlic] = await db
      .insert(schema.ingredients)
      .values({ householdId: household, name: "Garlic", createdAt: new Date() })
      .returning();

    await db
      .insert(schema.ingredients)
      .values(
        ["Acremella", "Crème fraîche", "Semi-skimmed milk", "Halfskimmed", "Aknot", "Hokmaal"].map(
          (name) => ({ householdId: household, name, createdAt: new Date() })
        )
      );
    await db.insert(schema.ingredientAliases).values({
      householdId: household,
      text: "Knoflook",
      fold: "knoflook",
      locale: "nl",
      ingredientId: garlic!.id,
    });

    expect(await names(parseIngredientSearch("creme"))).toEqual(["Crème fraîche", "Acremella"]);
    expect(await names(parseIngredientSearch("skimmed"))).toEqual([
      "Semi-skimmed milk",
      "Halfskimmed",
    ]);
    expect(await names(parseIngredientSearch("kn"))).toEqual(["Aknot", "Garlic"]);
    expect(await names(parseIngredientSearch("kn"), ["nl"])).toEqual(["Garlic", "Aknot"]);
    // Several words rank by the first one typed.
    expect(await names(parseIngredientSearch("h o"))).toEqual(["Hokmaal", "Chocolate"]);
  });

  it("finds a name in any script by part of it, as foldName folds the typed text", async () => {
    await getTestDb()
      .insert(schema.ingredients)
      .values(
        ["김치찌개", "ゴボウ", "Crème brûlée", "Extra virgin olive oil"].map((name) => ({
          householdId: household,
          name,
          createdAt: new Date(),
        }))
      );

    expect(await names(parseIngredientSearch("김치"))).toEqual(["김치찌개"]);
    expect(await names(parseIngredientSearch("ボウ"))).toEqual(["ゴボウ"]);
    expect(await names(parseIngredientSearch("brulee"))).toEqual(["Crème brûlée"]);
    expect(await names(parseIngredientSearch("brûlée crè"))).toEqual(["Crème brûlée"]);
    expect(await names(parseIngredientSearch("oil virgin extra"))).toEqual([
      "Extra virgin olive oil",
    ]);
  });

  it("ranks by the name and the translations in the reader's languages, finding every one", async () => {
    const db = getTestDb();
    const [prawn] = await db
      .insert(schema.ingredients)
      .values({ householdId: household, name: "Prawn", createdAt: new Date() })
      .returning();

    await db.insert(schema.ingredients).values(
      ["Tomato", "Cherry tomato"].map((name) => ({
        householdId: household,
        name,
        createdAt: new Date(),
      }))
    );
    await db.insert(schema.ingredientAliases).values({
      householdId: household,
      text: "Tôm",
      fold: "tom",
      locale: "vi",
      ingredientId: prawn!.id,
    });

    expect(await names(parseIngredientSearch("tom"))).toEqual(["Cherry tomato", "Tomato", "Prawn"]);
    expect(await names(parseIngredientSearch("tom"), ["vi"])).toEqual([
      "Prawn",
      "Cherry tomato",
      "Tomato",
    ]);
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

  it("lists and finds nothing of another household's, nor its spelling on a seeded food", async () => {
    const db = getTestDb();
    const neighbour = testHouseholdOf((await createTestUser()).id);
    const [seeded] = await db
      .insert(schema.ingredients)
      .values({ name: "Leek", offId: "en:leek", createdAt: new Date() })
      .returning();

    await db.insert(schema.ingredients).values({ householdId: neighbour, name: "Onion soup" });
    await db.insert(schema.ingredientAliases).values({
      householdId: neighbour,
      text: "Prei",
      fold: "prei",
      ingredientId: seeded!.id,
    });

    expect(await names(parseIngredientSearch("onion"))).toEqual(["Onion", "Red onion"]);
    expect(await names(parseIngredientSearch("prei"))).toEqual([]);
    expect(await names(parseIngredientSearch("leek"))).toEqual(["Leek"]);
  });

  it("lists everything without a search", async () => {
    expect(await names(null)).toEqual(["Chocolate", "Onion", "Red onion"]);
  });
});

describe("countListedIngredients", () => {
  const testBase = new RepositoryTestBase("test_ingredient_count");

  beforeAll(async () => {
    await testBase.setup();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("counts a household's listed foods and the seed's, never another household's", async () => {
    const [user] = await testBase.beforeEachTest();
    const mine = testHouseholdOf(user.id);
    const theirs = testHouseholdOf((await createTestUser()).id);
    const db = getTestDb();
    const before = await countListedIngredients(mine);

    await db.insert(schema.ingredients).values([
      { name: "Leek", offId: "en:leek" },
      { name: "Mine", householdId: mine, addedByHand: true },
      { name: "Mine too", householdId: mine, addedByHand: true },
      { name: "Unlisted", householdId: mine },
      { name: "Theirs", householdId: theirs, addedByHand: true },
    ]);

    expect(await countListedIngredients(mine)).toBe(before + 3);
    expect(await countListedIngredients(theirs)).toBe(before + 2);
  });
});

/**
 * What still uses a food: the uses one viewer may see, the rest counted, and
 * everything a delete would touch.
 */
describe("ingredient uses", () => {
  const testBase = new RepositoryTestBase("test_ingredient_uses");
  let me: { id: string };
  let neighbourId: string;
  let chickenId: string;
  let recipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();

    const db = getTestDb();
    const neighbour = await createTestUser();
    const chicken = await createTestIngredient({ name: "kipfilet" });

    neighbourId = neighbour!.id;
    const [hand] = await db
      .insert(schema.ingredientAliases)
      .values({
        text: "kipfilet met de hand",
        fold: "kipfilet met de hand",
        ingredientId: chicken!.id,
      })
      .returning();

    me = (await createTestUser())!;
    chickenId = chicken!.id;
    recipeId = (await createTestRecipe(me.id, { name: "Saté" })).id;
    // Two lines of one recipe, through the food's own name.
    await createTestRecipeIngredients(recipeId, chickenId, "metric");
    await createTestRecipeIngredients(recipeId, chickenId, "metric", { order: "1" });
    await db.insert(schema.groceries).values([
      {
        householdId: testHouseholdOf(me.id),
        userId: me.id,
        name: "kipfilet met de hand",
        ingredientAliasId: hand!.id,
        isDone: true,
      },
      {
        householdId: testHouseholdOf(neighbour!.id),
        userId: neighbour!.id,
        name: "kipfilet",
        ingredientId: chickenId,
      },
    ]);
    await db.insert(schema.pantryIngredients).values({
      householdId: testHouseholdOf(me.id),
      userId: me.id,
      ingredientId: chickenId,
    });
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("lists and counts the household's own uses alone, a recipe once", async () => {
    const mine = testHouseholdOf(me.id);
    const theirs = testHouseholdOf(neighbourId);

    expect(await listIngredientUses(mine, chickenId)).toEqual({
      groceries: [
        { id: expect.any(String), name: "kipfilet met de hand", done: true, recurring: false },
      ],
      pantry: true,
    });
    expect(await listIngredientRecipes(mine, chickenId)).toEqual({
      recipes: [{ id: recipeId, name: "Saté" }],
      nextCursor: null,
    });
    expect(await countIngredientUses(mine, chickenId)).toEqual({
      recipes: 1,
      recipeLines: 2,
      groceries: 1,
      pantry: 1,
    });
    // The neighbour's household sees its grocery, and none of the other's recipe or Pantry.
    expect(await listIngredientUses(theirs, chickenId)).toEqual({
      groceries: [{ id: expect.any(String), name: "kipfilet", done: false, recurring: false }],
      pantry: false,
    });
    expect(await listIngredientRecipes(theirs, chickenId)).toEqual({
      recipes: [],
      nextCursor: null,
    });
    expect(await countIngredientUses(theirs, chickenId)).toEqual({
      recipes: 0,
      recipeLines: 0,
      groceries: 1,
      pantry: 0,
    });
  });

  it("pages the household's recipes using a food by lowered name and a cursor", async () => {
    const mine = testHouseholdOf(me.id);
    const other = (await createTestRecipe(me.id, { name: "Kip curry" })).id;
    const lower = (await createTestRecipe(me.id, { name: "kip pilav" })).id;
    const neighbours = (await createTestRecipe(neighbourId, { name: "Kip pie" })).id;

    for (const id of [other, lower, neighbours]) {
      await createTestRecipeIngredients(id, chickenId, "metric");
    }

    const first = await listIngredientRecipes(mine, chickenId, { limit: 1 });

    expect(first).toEqual({
      recipes: [{ id: other, name: "Kip curry" }],
      nextCursor: { name: "kip curry", id: other },
    });
    // A recipe added before the cursor between pages repeats none.
    const early = (await createTestRecipe(me.id, { name: "Aardappel kip" })).id;

    await createTestRecipeIngredients(early, chickenId, "metric");
    const second = await listIngredientRecipes(mine, chickenId, {
      limit: 2,
      cursor: first!.nextCursor,
    });

    expect(second).toEqual({
      recipes: [
        { id: lower, name: "kip pilav" },
        { id: recipeId, name: "Saté" },
      ],
      nextCursor: null,
    });
    expect((await countIngredientUses(mine, chickenId))?.recipes).toBe(4);
  });

  it("finds nothing of another household's own food by its id", async () => {
    const theirs = await createTestIngredient({
      name: "kipdij",
      householdId: testHouseholdOf(neighbourId),
    });

    await expect(listIngredientUses(testHouseholdOf(me.id), theirs!.id)).resolves.toBeNull();
    await expect(countIngredientUses(testHouseholdOf(me.id), theirs!.id)).resolves.toBeNull();
    await expect(listIngredientRecipes(testHouseholdOf(me.id), theirs!.id)).resolves.toBeNull();
    await expect(countIngredientUses(testHouseholdOf(neighbourId), theirs!.id)).resolves.toEqual({
      recipes: 0,
      recipeLines: 0,
      groceries: 0,
      pantry: 0,
    });
  });

  it("lists a line naming several foods under each of them", async () => {
    const satay = await createTestIngredient({ name: "satésaus" });
    const ricePan = (await createTestRecipe(me.id, { name: "Rijstpan" })).id;

    await insertTestRecipeLine(
      { recipeId: ricePan, name: "kipfilet en satésaus", joined: "together", order: "0" },
      [(await firstSpellingId(chickenId))!, (await firstSpellingId(satay!.id))!]
    );

    const household = testHouseholdOf(me.id);

    expect((await listIngredientRecipes(household, satay!.id))?.recipes).toEqual([
      { id: ricePan, name: "Rijstpan" },
    ]);
    expect((await countIngredientUses(household, chickenId))?.recipeLines).toBe(3);
  });

  it("lists and counts a repeating grocery once, not again for the copy it keeps on the list", async () => {
    const db = getTestDb();
    const [recurring] = await db
      .insert(schema.recurringGroceries)
      .values({
        householdId: testHouseholdOf(me.id),
        userId: me.id,
        name: "kipfilet",
        ingredientId: chickenId,
        recurrenceRule: "week",
        nextPlannedFor: "2027-01-01",
      })
      .returning({ id: schema.recurringGroceries.id });

    await db.insert(schema.groceries).values({
      householdId: testHouseholdOf(me.id),
      userId: me.id,
      name: "kipfilet",
      ingredientId: chickenId,
      recurringGroceryId: recurring!.id,
    });

    const uses = await listIngredientUses(testHouseholdOf(me.id), chickenId);

    expect(uses?.groceries).toEqual([
      { id: expect.any(String), name: "kipfilet met de hand", done: true, recurring: false },
      { id: recurring!.id, name: "kipfilet", done: false, recurring: true },
    ]);
    expect((await countIngredientUses(testHouseholdOf(me.id), chickenId))?.groceries).toBe(2);
  });
});

describe("removing a spelling", () => {
  const testBase = new RepositoryTestBase("test_catalogue_alias_removal");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("refuses a food's last spelling, which would leave what used it nowhere to go", async () => {
    const salt = (await createTestIngredient({ name: "zout" }))!;
    const [only] = await getTestDb()
      .select({ id: schema.ingredientAliases.id })
      .from(schema.ingredientAliases)
      .where(eq(schema.ingredientAliases.ingredientId, salt.id));

    await expect(withTransaction((tx) => deleteCatalogueAlias(tx, only!.id))).rejects.toThrow(
      "last"
    );
  });
});

describe("insertSeededIngredient", () => {
  const testBase = new RepositoryTestBase("test_insert_seeded_ingredient");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("writes the food with each spelling seeded, in its own language", async () => {
    const id = await insertSeededIngredient(
      { name: "courgette", offId: "en:courgette", flagged: true },
      [
        { text: "courgette", fold: "courgette", locale: "en" },
        { text: "zucchine", fold: "zucchine", locale: "it" },
      ]
    );
    const db = getTestDb();
    const [food] = await db.select().from(schema.ingredients).where(eq(schema.ingredients.id, id));
    const spellings = await db
      .select()
      .from(schema.ingredientAliases)
      .where(eq(schema.ingredientAliases.ingredientId, id));

    expect(food).toMatchObject({ name: "courgette", flagged: true });
    expect(
      spellings
        .map(({ text, locale, seeded }) => ({ text, locale, seeded }))
        .sort((a, b) => a.text.localeCompare(b.text))
    ).toEqual([
      { text: "courgette", locale: "en", seeded: true },
      { text: "zucchine", locale: "it", seeded: true },
    ]);
  });
});

describe("forEachCatalogue", () => {
  const testBase = new RepositoryTestBase("test_catalogue_households");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("runs in every household holding a food or a spelling of its own, a seeded food's included", async () => {
    const [withFood, withSpelling, without] = [
      testHouseholdOf((await createTestUser()).id),
      testHouseholdOf((await createTestUser()).id),
      testHouseholdOf((await createTestUser()).id),
    ];
    const leek = (await createTestIngredient({ name: "leek" }))!;

    await createTestIngredient({ name: "prei", householdId: withFood });
    await getTestDb().insert(schema.ingredientAliases).values({
      householdId: withSpelling,
      text: "stokprei",
      fold: "stokprei",
      ingredientId: leek.id,
    });

    const listed = await forEachCatalogue(async (householdId) => householdId);

    expect(listed.sort()).toEqual([withFood, withSpelling].sort());
    expect(listed).not.toContain(without);
  });
});

describe("a food's writes carry the household that was checked", () => {
  const testBase = new RepositoryTestBase("test_catalogue_household_writes");

  beforeAll(async () => {
    await testBase.setup();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("changes nothing once the food is another household's", async () => {
    const [user] = await testBase.beforeEachTest();
    const food = await mintTestFood(testHouseholdOf(user.id), "prei");
    const checked = testHouseholdOf((await createTestUser()).id);

    await withTransaction(async (tx) => {
      expect(await renameCatalogueIngredient(tx, food.ingredientId, "Leek", checked)).toBeNull();
      expect(await keepIngredientDistinct(tx, food.ingredientId, checked)).toBeNull();
      expect(
        await setIngredientIcon(tx, food.ingredientId, "x.webp", { householdId: checked })
      ).toBe(false);
    });
    expect(await readTestIngredient(food.ingredientId)).toMatchObject({
      name: "prei",
      keptDistinct: false,
      icon: null,
    });
  });
});
