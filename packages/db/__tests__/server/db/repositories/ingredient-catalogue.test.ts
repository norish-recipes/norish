// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { withTransaction } from "@norish/db/drizzle";
import {
  deleteCatalogueAlias,
  listCatalogueIngredients,
  listIngredientUses,
} from "@norish/db/repositories/ingredient-catalogue";
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

  beforeEach(async () => {
    await testBase.beforeEachTest();

    const db = getTestDb();
    const [onion] = await db
      .insert(schema.ingredients)
      .values({ name: "Onion", createdAt: new Date() })
      .returning();
    const [redOnion] = await db
      .insert(schema.ingredients)
      .values({ name: "Red onion", parentId: onion!.id, createdAt: new Date() })
      .returning();

    await db.insert(schema.ingredients).values({ name: "Chocolate", createdAt: new Date() });
    await db.insert(schema.ingredientAliases).values([
      { text: "Onion", fold: "onion", ingredientId: onion!.id },
      { text: "Ui", fold: "ui", locale: "nl", ingredientId: onion!.id },
      { text: "Red onion", fold: "red onion", ingredientId: redOnion!.id },
    ]);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const names = async (search: ReturnType<typeof parseIngredientSearch>) =>
    (await listCatalogueIngredients({ search, flaggedOnly: false, limit: 10, offset: 0 })).map(
      (row) => row.name
    );

  it("finds the text anywhere in a name, the exact name first", async () => {
    expect(await names(parseIngredientSearch("onion"))).toEqual(["Onion", "Red onion"]);
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

  it("lists everything without a search", async () => {
    expect(await names(null)).toEqual(["Chocolate", "Onion", "Red onion"]);
  });
});

/**
 * What still uses a food: the uses one viewer may see, the rest counted, and
 * everything a delete would touch.
 */
describe("ingredient uses", () => {
  const testBase = new RepositoryTestBase("test_ingredient_uses");
  let me: { id: string };
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
      { userId: me.id, name: "kipfilet met de hand", ingredientAliasId: hand!.id, isDone: true },
      { userId: neighbour!.id, name: "kipfilet", ingredientId: chickenId },
    ]);
    await db.insert(schema.pantryIngredients).values({ userId: me.id, ingredientId: chickenId });
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("lists the uses the viewer may see, a recipe once, and counts everything a delete touches", async () => {
    expect(
      await listIngredientUses(
        { userId: me.id, householdUserIds: null, isServerAdmin: false },
        chickenId
      )
    ).toEqual({
      recipes: [{ id: recipeId, name: "Saté" }],
      groceries: [
        { id: expect.any(String), name: "kipfilet met de hand", done: true, recurring: false },
      ],
      pantry: true,
      elsewhere: 1,
      counts: { recipeLines: 2, groceries: 2, pantry: 1 },
    });
  });

  it("lists a line naming several foods under each of them", async () => {
    const satay = await createTestIngredient({ name: "satésaus" });
    const ricePan = (await createTestRecipe(me.id, { name: "Rijstpan" })).id;

    await insertTestRecipeLine(
      { recipeId: ricePan, name: "kipfilet en satésaus", joined: "together", order: "0" },
      [(await firstSpellingId(chickenId))!, (await firstSpellingId(satay!.id))!]
    );

    const viewer = { userId: me.id, householdUserIds: null, isServerAdmin: false };

    expect((await listIngredientUses(viewer, satay!.id)).recipes).toEqual([
      { id: ricePan, name: "Rijstpan" },
    ]);
    expect((await listIngredientUses(viewer, chickenId)).counts.recipeLines).toBe(3);
  });

  it("lists and counts a repeating grocery once, not again for the copy it keeps on the list", async () => {
    const db = getTestDb();
    const [recurring] = await db
      .insert(schema.recurringGroceries)
      .values({
        userId: me.id,
        name: "kipfilet",
        ingredientId: chickenId,
        recurrenceRule: "week",
        nextPlannedFor: "2027-01-01",
      })
      .returning({ id: schema.recurringGroceries.id });

    await db.insert(schema.groceries).values({
      userId: me.id,
      name: "kipfilet",
      ingredientId: chickenId,
      recurringGroceryId: recurring!.id,
    });

    const uses = await listIngredientUses(
      { userId: me.id, householdUserIds: null, isServerAdmin: false },
      chickenId
    );

    expect(uses.groceries).toEqual([
      { id: expect.any(String), name: "kipfilet met de hand", done: true, recurring: false },
      { id: recurring!.id, name: "kipfilet", done: false, recurring: true },
    ]);
    expect(uses.elsewhere).toBe(1);
    expect(uses.counts.groceries).toBe(3);
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
    const id = await insertSeededIngredient({ name: "courgette", flagged: true }, [
      { text: "courgette", fold: "courgette", locale: "en" },
      { text: "zucchine", fold: "zucchine", locale: "it" },
    ]);
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
