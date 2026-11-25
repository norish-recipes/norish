// @vitest-environment node
// What one account deletion erases, keeps and changes (ADR-0041), table by table: the cases
// are a member, an admin with members, a last member, and references across households.
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isRetryableConflict } from "@norish/db/repositories/constraint-violation";
import { addRecipeToCookbook, createCookbook } from "@norish/db/repositories/cookbooks";
import { addFavorite } from "@norish/db/repositories/favorites";
import {
  deleteAccount,
  joinHousehold,
  moveToHouseholdOfOne,
} from "@norish/db/repositories/households";
import { createPlannedItem } from "@norish/db/repositories/planned-items";
import { rateRecipe } from "@norish/db/repositories/ratings";
import { createStore } from "@norish/db/repositories/stores";
import {
  accounts,
  apiKeys,
  caldavSyncStatus,
  cookbookRecipes,
  cookbooks,
  groceries,
  households,
  householdUsers,
  ingredientNutritionCorrections,
  ingredientStorePreferences,
  pantryIngredients,
  plannedItems,
  recipeFavorites,
  recipeImages,
  recipeIngredients,
  recipeRatings,
  recipes,
  recipeShares,
  recipeVideos,
  recurringGroceries,
  sessions,
  siteAuthTokens,
  stepImages,
  steps,
  stores,
  tags,
  userAllergies,
  userCaldavConfig,
  users,
} from "@norish/db/schema";

import {
  addTestGrocery,
  addTestPantryIngredient,
  addTestRecurringGrocery,
  addTestStepImage,
  createTestIngredient,
  createTestRecipe,
  createTestRecipeShare,
  createTestRecipeStep,
  createTestUser,
  getTestDb,
  householdIdOf,
  insertTestRecipeLine,
  joinTestHousehold,
} from "../../../helpers/db-test-helpers";
import { lockWaits, raceBehind, waitFor } from "../../../helpers/lock-race";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const DAY = "2031-05-06";

describe("deleting an account", () => {
  const testBase = new RepositoryTestBase("test_account_deletion");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** Everything an account has of its own, and a recipe and a cookbook it owns. */
  async function accountWithThings(userId: string, name: string) {
    const db = getTestDb();
    const recipe = await createTestRecipe(userId, { name });
    const cookbook = await createCookbook({ userId, title: `${name} book` });
    const [tag] = await db
      .insert(tags)
      .values({ name: `${name} allergen` })
      .returning();

    await db.insert(userAllergies).values({ userId, tagId: tag!.id });
    await db.insert(apiKeys).values({ referenceId: userId, key: `key-${name}` });
    await db
      .insert(accounts)
      .values({ id: `account-${name}`, userId, providerId: "credential", accountId: userId });
    await db.insert(userCaldavConfig).values({
      userId,
      serverUrlEnc: "url",
      usernameEnc: "user",
      passwordEnc: "password",
    });
    await db
      .insert(siteAuthTokens)
      .values({ userId, domain: "example.com", name: "session", valueEnc: "x", type: "cookie" });
    await db.insert(sessions).values({
      userId,
      token: `session-${name}-${userId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await db.insert(caldavSyncStatus).values({
      userId,
      itemId: crypto.randomUUID(),
      itemType: "note",
      eventTitle: name,
    });
    await addRecipeToCookbook(cookbook.id, recipe.id);
    await db
      .insert(recipeImages)
      .values({ recipeId: recipe.id, image: `/recipes/${recipe.id}/a.jpg` });
    await db
      .insert(recipeVideos)
      .values({ recipeId: recipe.id, video: `/recipes/${recipe.id}/v.mp4` });
    const step = await createTestRecipeStep(recipe.id, "metric", { step: "Roer" });

    await addTestStepImage(step!.id, `/recipes/${recipe.id}/steps/s.jpg`);

    return { recipe, cookbook };
  }

  /** The recipes' own rows: images, videos, steps and step images; all gone with them. */
  async function mediaOf(recipeIds: string[]) {
    const db = getTestDb();
    const stepIds = (
      await db.select({ id: steps.id }).from(steps).where(inArray(steps.recipeId, recipeIds))
    ).map((row) => row.id);

    return {
      images: (
        await db.select().from(recipeImages).where(inArray(recipeImages.recipeId, recipeIds))
      ).length,
      videos: (
        await db.select().from(recipeVideos).where(inArray(recipeVideos.recipeId, recipeIds))
      ).length,
      steps: stepIds.length,
      stepImages: stepIds.length
        ? (await db.select().from(stepImages).where(inArray(stepImages.stepId, stepIds))).length
        : 0,
    };
  }

  const NO_MEDIA = { images: 0, videos: 0, steps: 0, stepImages: 0 };

  /** The step-image rows of these recipes, read before their steps go. */
  async function stepImageIdsOf(recipeIds: string[]) {
    const rows = await getTestDb()
      .select({ id: stepImages.id })
      .from(stepImages)
      .innerJoin(steps, eq(steps.id, stepImages.stepId))
      .where(inArray(steps.recipeId, recipeIds));

    return rows.map((row) => row.id);
  }

  async function stepImagesLeft(ids: string[]) {
    return getTestDb().select().from(stepImages).where(inArray(stepImages.id, ids));
  }

  /** Who added each of the household's things, table by table, in a stable order. */
  async function householdThings(householdId: string) {
    const db = getTestDb();
    const addedBy = async (rows: Promise<Array<{ userId: string | null; id: string }>>) =>
      (await rows).sort((a, b) => a.id.localeCompare(b.id)).map((row) => row.userId);
    return {
      stores: await addedBy(
        db
          .select({ id: stores.id, userId: stores.userId })
          .from(stores)
          .where(eq(stores.householdId, householdId))
      ),
      groceries: await addedBy(
        db
          .select({ id: groceries.id, userId: groceries.userId })
          .from(groceries)
          .where(eq(groceries.householdId, householdId))
      ),
      recurring: await addedBy(
        db
          .select({ id: recurringGroceries.id, userId: recurringGroceries.userId })
          .from(recurringGroceries)
          .where(eq(recurringGroceries.householdId, householdId))
      ),
      pantry: await addedBy(
        db
          .select({ id: pantryIngredients.id, userId: pantryIngredients.userId })
          .from(pantryIngredients)
          .where(eq(pantryIngredients.householdId, householdId))
      ),
      plan: await addedBy(
        db
          .select({ id: plannedItems.id, userId: plannedItems.userId })
          .from(plannedItems)
          .where(eq(plannedItems.householdId, householdId))
      ),
      corrections: await addedBy(
        db
          .select({
            id: ingredientNutritionCorrections.id,
            userId: ingredientNutritionCorrections.userId,
          })
          .from(ingredientNutritionCorrections)
          .where(eq(ingredientNutritionCorrections.householdId, householdId))
      ),
      storePreferences: await addedBy(
        db
          .select({ id: ingredientStorePreferences.id, userId: ingredientStorePreferences.userId })
          .from(ingredientStorePreferences)
          .where(eq(ingredientStorePreferences.householdId, householdId))
      ),
    };
  }

  /** The same things, with every row the deleted account added now added by no one. */
  const addedByNoOne = (things: Awaited<ReturnType<typeof householdThings>>, userId: string) =>
    Object.fromEntries(
      Object.entries(things).map(([table, adders]) => [
        table,
        adders.map((adder) => (adder === userId ? null : adder)),
      ])
    );

  /** The account's own rows, table by table; all empty once it is deleted. */
  async function ownRows(userId: string) {
    const db = getTestDb();
    const count = async (rows: Promise<unknown[]>) => (await rows).length;

    return {
      user: await count(db.select().from(users).where(eq(users.id, userId))),
      recipes: await count(db.select().from(recipes).where(eq(recipes.userId, userId))),
      cookbooks: await count(db.select().from(cookbooks).where(eq(cookbooks.userId, userId))),
      favourites: await count(
        db.select().from(recipeFavorites).where(eq(recipeFavorites.userId, userId))
      ),
      ratings: await count(db.select().from(recipeRatings).where(eq(recipeRatings.userId, userId))),
      shares: await count(db.select().from(recipeShares).where(eq(recipeShares.userId, userId))),
      allergies: await count(
        db.select().from(userAllergies).where(eq(userAllergies.userId, userId))
      ),
      apiKeys: await count(db.select().from(apiKeys).where(eq(apiKeys.referenceId, userId))),
      signIns: await count(db.select().from(accounts).where(eq(accounts.userId, userId))),
      caldav: await count(
        db.select().from(userCaldavConfig).where(eq(userCaldavConfig.userId, userId))
      ),
      siteAccounts: await count(
        db.select().from(siteAuthTokens).where(eq(siteAuthTokens.userId, userId))
      ),
      membership: await count(
        db.select().from(householdUsers).where(eq(householdUsers.userId, userId))
      ),
      sessions: await count(db.select().from(sessions).where(eq(sessions.userId, userId))),
      caldavStatuses: await count(
        db.select().from(caldavSyncStatus).where(eq(caldavSyncStatus.userId, userId))
      ),
    };
  }

  const NOTHING = {
    user: 0,
    recipes: 0,
    cookbooks: 0,
    favourites: 0,
    ratings: 0,
    shares: 0,
    allergies: 0,
    apiKeys: 0,
    signIns: 0,
    caldav: 0,
    siteAccounts: 0,
    membership: 0,
    sessions: 0,
    caldavStatuses: 0,
  };

  /** What refers to these recipes from anywhere: favourites, ratings, shares, cookbook entries. */
  async function referencesTo(recipeIds: string[]) {
    const db = getTestDb();

    return [
      ...(await db
        .select()
        .from(recipeFavorites)
        .where(inArray(recipeFavorites.recipeId, recipeIds))),
      ...(await db.select().from(recipeRatings).where(inArray(recipeRatings.recipeId, recipeIds))),
      ...(await db.select().from(recipeShares).where(inArray(recipeShares.recipeId, recipeIds))),
      ...(await db
        .select()
        .from(cookbookRecipes)
        .where(inArray(cookbookRecipes.recipeId, recipeIds))),
      ...(await db
        .select()
        .from(recipeIngredients)
        .where(inArray(recipeIngredients.recipeId, recipeIds))),
    ];
  }

  async function planOf(householdId: string) {
    return await getTestDb()
      .select({
        itemType: plannedItems.itemType,
        recipeId: plannedItems.recipeId,
        title: plannedItems.title,
        date: plannedItems.date,
        slot: plannedItems.slot,
        userId: plannedItems.userId,
        version: plannedItems.version,
      })
      .from(plannedItems)
      .where(eq(plannedItems.householdId, householdId))
      .orderBy(plannedItems.createdAt);
  }

  const planRecipe = (householdId: string, userId: string, recipeId: string) =>
    createPlannedItem({
      householdId,
      userId,
      date: DAY,
      slot: "Dinner",
      itemType: "recipe",
      recipeId,
      title: null,
    });

  /**
   * A household of an admin and the account, a stranger's household beside it. Each has a recipe;
   * the others favourite, rate, share, collect, plan and shop from the account's.
   */
  async function world() {
    const admin = (await createTestUser())!.id;
    const deleted = (await createTestUser())!.id;
    const stranger = (await createTestUser())!.id;
    const household = await joinTestHousehold(deleted, admin);
    const elsewhere = await householdIdOf(stranger);
    const own = await accountWithThings(deleted, "Soep");
    const admins = await accountWithThings(admin, "Stoof");
    const strangers = await accountWithThings(stranger, "Taart");
    const [line] = await getTestDb()
      .insert(recipeIngredients)
      .values({ recipeId: own.recipe.id, name: "200 g prei" })
      .returning();

    await insertTestRecipeLine({ recipeId: admins.recipe.id, name: "1 ui" });
    for (const reader of [deleted, admin, stranger]) {
      for (const recipe of [own.recipe, admins.recipe]) {
        await addFavorite(reader, recipe.id);
        await rateRecipe(reader, recipe.id, 4);
        await createTestRecipeShare(reader, recipe.id, { token: `${reader}-${recipe.id}` });
      }
    }
    await addRecipeToCookbook(admins.cookbook.id, own.recipe.id);
    await addRecipeToCookbook(strangers.cookbook.id, own.recipe.id);
    await addRecipeToCookbook(own.cookbook.id, admins.recipe.id);
    await planRecipe(household, admin, own.recipe.id);
    await planRecipe(elsewhere, stranger, own.recipe.id);
    await planRecipe(household, deleted, admins.recipe.id);
    await addTestGrocery(stranger, { name: "prei", recipeIngredientId: line!.id });
    await addTestGrocery(deleted, { name: "melk" });
    const store = await createStore(crypto.randomUUID(), {
      householdId: household,
      userId: deleted,
      name: "Markt",
    });
    const food = (await createTestIngredient({ name: `prei ${deleted}` }))!;

    await addTestRecurringGrocery(deleted, { name: "eieren" });
    await addTestPantryIngredient(deleted, { ingredientId: food.id });
    await getTestDb()
      .insert(ingredientNutritionCorrections)
      .values({ householdId: household, userId: deleted, ingredientId: food.id });
    await getTestDb().insert(ingredientStorePreferences).values({
      householdId: household,
      userId: deleted,
      ingredientId: food.id,
      storeId: store.id,
    });

    return { admin, deleted, stranger, household, elsewhere, own, admins, strangers };
  }

  describe("of a member of a household with others", () => {
    it("erases what the account owns and has, and nothing of anyone else's", async () => {
      const w = await world();
      const adminRowsBefore = await ownRows(w.admin);
      const strangerRowsBefore = await ownRows(w.stranger);
      const thingsBefore = await householdThings(w.household);
      const elsewhereBefore = await householdThings(w.elsewhere);

      const stepImagesBefore = await stepImageIdsOf([w.own.recipe.id]);

      const deletion = await deleteAccount(w.deleted);

      expect(Object.values(thingsBefore).every((adders) => adders.includes(w.deleted))).toBe(true);
      expect(deletion).toMatchObject({
        householdId: w.household,
        householdErased: false,
        successorId: null,
        memberIds: [w.admin],
        recipeIds: [w.own.recipe.id],
        cookbookIds: [w.own.cookbook.id],
      });
      expect(await ownRows(w.deleted)).toEqual(NOTHING);
      expect(await referencesTo([w.own.recipe.id])).toEqual([]);
      expect(await mediaOf([w.own.recipe.id])).toEqual(NO_MEDIA);
      expect(stepImagesBefore).toHaveLength(1);
      expect(await stepImagesLeft(stepImagesBefore)).toEqual([]);
      expect(await mediaOf([w.admins.recipe.id, w.strangers.recipe.id])).toEqual({
        images: 2,
        videos: 2,
        steps: 2,
        stepImages: 2,
      });
      // The household keeps every row, the ones the account added now added by no one.
      expect(await householdThings(w.household)).toEqual(addedByNoOne(thingsBefore, w.deleted));
      expect(await householdThings(w.elsewhere)).toEqual(elsewhereBefore);

      // Everyone else keeps their own rows; only their favourite, rating, share of it went.
      const lessOne = (rows: typeof adminRowsBefore) => ({
        ...rows,
        favourites: rows.favourites - 1,
        ratings: rows.ratings - 1,
        shares: rows.shares - 1,
      });

      expect(await ownRows(w.admin)).toEqual(lessOne(adminRowsBefore));
      expect(await ownRows(w.stranger)).toEqual(lessOne(strangerRowsBefore));
      // Their cookbooks keep everything but the erased recipe.
      expect(
        await getTestDb()
          .select({ recipeId: cookbookRecipes.recipeId })
          .from(cookbookRecipes)
          .where(
            inArray(cookbookRecipes.cookbookId, [w.admins.cookbook.id, w.strangers.cookbook.id])
          )
      ).toEqual(
        expect.arrayContaining([
          { recipeId: w.admins.recipe.id },
          { recipeId: w.strangers.recipe.id },
        ])
      );
    });

    it("turns every household's plan entries for its recipes into notes with the title", async () => {
      const w = await world();

      const deletion = await deleteAccount(w.deleted);
      const note = { itemType: "note", recipeId: null, title: "Soep", date: DAY, slot: "Dinner" };

      expect(await planOf(w.household)).toEqual([
        { ...note, userId: w.admin, version: 2 },
        // The account's own entry for another's recipe stays a recipe, added by no one.
        expect.objectContaining({ itemType: "recipe", recipeId: w.admins.recipe.id, userId: null }),
      ]);
      expect(await planOf(w.elsewhere)).toEqual([{ ...note, userId: w.stranger, version: 2 }]);
      expect(deletion.notes.map((entry) => entry.householdId).sort()).toEqual(
        [w.household, w.elsewhere].sort()
      );
    });

    it("keeps a note's own title, taking only its link to the recipe", async () => {
      const w = await world();

      await createPlannedItem({
        householdId: w.elsewhere,
        userId: w.stranger,
        date: DAY,
        slot: "Lunch",
        itemType: "note",
        recipeId: w.own.recipe.id,
        title: "Soep bij oma",
      });
      await deleteAccount(w.deleted);

      expect(await planOf(w.elsewhere)).toEqual([
        expect.objectContaining({ itemType: "note", recipeId: null, title: "Soep" }),
        expect.objectContaining({ itemType: "note", recipeId: null, title: "Soep bij oma" }),
      ]);
    });

    it("gives a recipe entry the recipe's name, not a stored title it never showed", async () => {
      const w = await world();

      await createPlannedItem({
        householdId: w.elsewhere,
        userId: w.stranger,
        date: DAY,
        slot: "Lunch",
        itemType: "recipe",
        recipeId: w.own.recipe.id,
        title: "Oude titel",
      });
      await deleteAccount(w.deleted);

      expect((await planOf(w.elsewhere)).map((entry) => entry.title)).toEqual(["Soep", "Soep"]);
    });

    it("keeps the household's things and the grocery lines made from its recipes", async () => {
      const w = await world();

      await deleteAccount(w.deleted);

      const lines = await getTestDb()
        .select({
          householdId: groceries.householdId,
          name: groceries.name,
          userId: groceries.userId,
          recipeIngredientId: groceries.recipeIngredientId,
        })
        .from(groceries);

      expect(lines).toEqual(
        expect.arrayContaining([
          { householdId: w.elsewhere, name: "prei", userId: w.stranger, recipeIngredientId: null },
          { householdId: w.household, name: "melk", userId: null, recipeIngredientId: null },
        ])
      );
      expect(
        await getTestDb()
          .select({ userId: stores.userId })
          .from(stores)
          .where(eq(stores.householdId, w.household))
      ).toEqual([{ userId: null }]);
    });
  });

  describe("of the admin of a household with others", () => {
    it("hands the role to who stays and erases the admin's recipes from every plan", async () => {
      const w = await world();
      const thingsBefore = await householdThings(w.household);
      const memberRowsBefore = await ownRows(w.deleted);

      const stepImagesBefore = await stepImageIdsOf([w.admins.recipe.id]);

      const deletion = await deleteAccount(w.admin);

      expect(deletion).toMatchObject({
        householdErased: false,
        successorId: w.deleted,
        memberIds: [w.deleted],
        recipeIds: [w.admins.recipe.id],
      });
      expect(
        await getTestDb()
          .select({ adminUserId: households.adminUserId })
          .from(households)
          .where(eq(households.id, w.household))
      ).toEqual([{ adminUserId: w.deleted }]);
      expect(await ownRows(w.admin)).toEqual(NOTHING);
      expect(await mediaOf([w.admins.recipe.id])).toEqual(NO_MEDIA);
      expect(stepImagesBefore).toHaveLength(1);
      expect(await stepImagesLeft(stepImagesBefore)).toEqual([]);
      expect(await referencesTo([w.admins.recipe.id])).toEqual([]);
      expect(await householdThings(w.household)).toEqual(addedByNoOne(thingsBefore, w.admin));
      expect(await ownRows(w.deleted)).toEqual({
        ...memberRowsBefore,
        favourites: memberRowsBefore.favourites - 1,
        ratings: memberRowsBefore.ratings - 1,
        shares: memberRowsBefore.shares - 1,
      });
      expect(await planOf(w.household)).toEqual([
        // The admin's entry for the account's recipe stays, added by no one.
        expect.objectContaining({ itemType: "recipe", recipeId: w.own.recipe.id, userId: null }),
        expect.objectContaining({ itemType: "note", title: "Stoof", userId: w.deleted }),
      ]);
    });
  });

  describe("of a household's last member", () => {
    it("erases the household with everything in it, and notes only the plans that stay", async () => {
      const w = await world();

      const stepImagesBefore = await stepImageIdsOf([w.own.recipe.id, w.admins.recipe.id]);

      await deleteAccount(w.deleted);
      const deletion = await deleteAccount(w.admin);

      expect(deletion).toMatchObject({
        householdId: w.household,
        householdErased: true,
        memberIds: [],
        recipeIds: [w.admins.recipe.id],
        cookbookIds: [w.admins.cookbook.id],
        notes: [],
      });
      expect(
        await getTestDb().select().from(households).where(eq(households.id, w.household))
      ).toEqual([]);
      expect(await householdThings(w.household)).toEqual({
        stores: [],
        groceries: [],
        recurring: [],
        pantry: [],
        plan: [],
        corrections: [],
        storePreferences: [],
      });
      expect(await ownRows(w.admin)).toEqual(NOTHING);
      expect(await mediaOf([w.own.recipe.id, w.admins.recipe.id])).toEqual(NO_MEDIA);
      expect(stepImagesBefore).toHaveLength(2);
      expect(await stepImagesLeft(stepImagesBefore)).toEqual([]);
      expect(await referencesTo([w.own.recipe.id, w.admins.recipe.id])).toEqual([]);
      // The stranger's household is untouched.
      expect(await planOf(w.elsewhere)).toEqual([
        expect.objectContaining({ itemType: "note", title: "Soep" }),
      ]);
      expect(await ownRows(w.stranger)).toMatchObject({ user: 1, recipes: 1, cookbooks: 1 });
    });

    it("turns another household's plan entry for its recipe into a note as its household goes", async () => {
      const w = await world();

      await deleteAccount(w.deleted);
      await planRecipe(w.elsewhere, w.stranger, w.admins.recipe.id);
      const deletion = await deleteAccount(w.admin);

      expect(deletion.householdErased).toBe(true);
      expect(deletion.notes).toEqual([
        expect.objectContaining({ householdId: w.elsewhere, title: "Stoof", recipeId: null }),
      ]);
      expect(await planOf(w.elsewhere)).toEqual([
        expect.objectContaining({ itemType: "note", title: "Soep" }),
        expect.objectContaining({ itemType: "note", title: "Stoof", userId: w.stranger }),
      ]);
    });
  });

  describe("racing", () => {
    type Tx = Parameters<Parameters<ReturnType<typeof getTestDb>["transaction"]>[0]>[0];
    const holdHousehold = (id: string) => (tx: Tx) =>
      tx.select({ id: households.id }).from(households).where(eq(households.id, id)).for("update");
    const holdRecipe = (id: string) => (tx: Tx) =>
      tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).for("update");
    const fulfilled = (value: unknown) => ({ status: "fulfilled", value });

    /** Every account in one household whose admin lives there; every recipe in its Owner's. */
    async function expectInvariant() {
      const db = getTestDb();
      const memberships = await db.select().from(householdUsers);

      for (const { id } of await db.select({ id: users.id }).from(users)) {
        expect(memberships.filter((m) => m.userId === id)).toHaveLength(1);
      }
      for (const household of await db.select().from(households)) {
        expect(memberships).toContainEqual(
          expect.objectContaining({ householdId: household.id, userId: household.adminUserId })
        );
      }
      for (const table of [recipes, cookbooks]) {
        const strays = await db
          .select({ id: table.id })
          .from(table)
          .leftJoin(
            householdUsers,
            sql`${householdUsers.userId} = ${table.userId} AND ${householdUsers.householdId} = ${table.householdId}`
          )
          .where(sql`${householdUsers.userId} IS NULL`);

        expect(strays).toEqual([]);
      }
    }

    it("a join queued behind the last member's deletion is refused, the household gone", async () => {
      const deleted = (await createTestUser())!.id;
      const joiner = (await createTestUser())!.id;
      const household = await householdIdOf(deleted);

      const settled = await raceBehind(holdHousehold(household), [
        () => deleteAccount(deleted),
        () => joinHousehold(joiner, { householdId: household }),
      ]);

      expect(settled).toEqual([
        fulfilled(expect.objectContaining({ householdErased: true })),
        fulfilled({ refused: "gone" }),
      ]);
      expect(
        await getTestDb().select().from(households).where(eq(households.id, household))
      ).toEqual([]);
      await expectInvariant();
    });

    it("an admin's deletion hands the role on before a member's leave, which is then refused", async () => {
      const admin = (await createTestUser())!.id;
      const first = (await createTestUser())!.id;
      const second = (await createTestUser())!.id;
      const household = await joinTestHousehold(first, admin);

      await joinTestHousehold(second, admin);
      const settled = await raceBehind(holdHousehold(household), [
        () => deleteAccount(admin),
        () => moveToHouseholdOfOne(household, first),
      ]);

      expect(settled).toEqual([
        fulfilled(expect.objectContaining({ successorId: first, memberIds: [first, second] })),
        {
          status: "rejected",
          reason: expect.objectContaining({
            message: expect.stringContaining("hands the role on"),
          }),
        },
      ]);
      await expectInvariant();
    });

    it("a member's leave before the admin's deletion leaves the role to who stays", async () => {
      const admin = (await createTestUser())!.id;
      const first = (await createTestUser())!.id;
      const second = (await createTestUser())!.id;
      const household = await joinTestHousehold(first, admin);

      await joinTestHousehold(second, admin);
      const settled = await raceBehind(holdHousehold(household), [
        () => moveToHouseholdOfOne(household, first),
        () => deleteAccount(admin),
      ]);

      expect(settled).toEqual([
        fulfilled(expect.objectContaining({ applied: true })),
        fulfilled(expect.objectContaining({ successorId: second, memberIds: [second] })),
      ]);
      await expectInvariant();
    });

    it.each([
      ["the admin's", 0],
      ["the member's", 1],
    ])(
      "two deletions in one household, %s first, take the household with the second",
      async (_, first) => {
        const admin = (await createTestUser())!.id;
        const member = (await createTestUser())!.id;
        const household = await joinTestHousehold(member, admin);
        const order = first === 0 ? [admin, member] : [member, admin];

        await createTestRecipe(admin, { name: "Soep" });
        await createTestRecipe(member, { name: "Stoof" });
        const settled = await raceBehind(
          holdHousehold(household),
          order.map((id) => () => deleteAccount(id))
        );

        expect(settled).toEqual([
          fulfilled(expect.objectContaining({ householdErased: false })),
          fulfilled(expect.objectContaining({ householdErased: true, memberIds: [] })),
        ]);
        expect(
          await getTestDb().select().from(households).where(eq(households.id, household))
        ).toEqual([]);
        expect(
          await getTestDb().select().from(recipes).where(inArray(recipes.userId, order))
        ).toEqual([]);
        await expectInvariant();
      }
    );

    it("a plan entry made before the deletion takes the recipe's lock becomes a note", async () => {
      const deleted = (await createTestUser())!.id;
      const stranger = (await createTestUser())!.id;
      const elsewhere = await householdIdOf(stranger);
      const recipe = await createTestRecipe(deleted, { name: "Soep" });

      const settled = await raceBehind(holdRecipe(recipe.id), [
        () => planRecipe(elsewhere, stranger, recipe.id),
        () => deleteAccount(deleted),
      ]);

      expect(settled.map((s) => s.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(await planOf(elsewhere)).toEqual([
        expect.objectContaining({ itemType: "note", recipeId: null, title: "Soep" }),
      ]);
      await expectInvariant();
    });

    it("a plan entry queued behind the deletion is refused, the recipe gone", async () => {
      const deleted = (await createTestUser())!.id;
      const stranger = (await createTestUser())!.id;
      const elsewhere = await householdIdOf(stranger);
      const recipe = await createTestRecipe(deleted, { name: "Soep" });

      const settled = await raceBehind(holdRecipe(recipe.id), [
        () => deleteAccount(deleted),
        () => planRecipe(elsewhere, stranger, recipe.id),
      ]);

      expect(settled[0]).toEqual(fulfilled(expect.objectContaining({ recipeIds: [recipe.id] })));
      expect(JSON.stringify((settled[1] as PromiseRejectedResult).reason)).toMatch(
        /"code":"23503"/
      );
      expect(await planOf(elsewhere)).toEqual([]);
      await expectInvariant();
    });
  });

  describe("deadlocked with a household write", () => {
    async function memberWithGrocery() {
      const admin = (await createTestUser())!.id;
      const deleted = (await createTestUser())!.id;
      const household = await joinTestHousehold(deleted, admin);
      const recipe = await createTestRecipe(deleted, { name: "Soep" });
      const grocery = await addTestGrocery(deleted, { name: "melk" });

      return { admin, deleted, household, recipe, grocery };
    }

    it("a grocery added while the deletion holds the household is refused for a retry", async () => {
      const m = await memberWithGrocery();
      const holdRecipe = (
        tx: Parameters<Parameters<ReturnType<typeof getTestDb>["transaction"]>[0]>[0]
      ) =>
        tx
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.id, m.recipe.id))
          .for("update");

      // The deletion holds the household and waits on the recipe; the grocery shifts the
      // deleted member's line, then waits on the household the deletion holds.
      const settled = await raceBehind(holdRecipe, [
        () => deleteAccount(m.deleted),
        () => addTestGrocery(m.admin, { name: "brood" }),
      ]);

      expect(settled[0]).toEqual({
        status: "fulfilled",
        value: expect.objectContaining({ recipeIds: [m.recipe.id] }),
      });
      expect(settled[1]?.status).toBe("rejected");
      expect(isRetryableConflict((settled[1] as PromiseRejectedResult).reason)).toBe(true);
      expect(await getTestDb().select().from(users).where(eq(users.id, m.deleted))).toEqual([]);
    });

    it("a deletion that is the deadlock's victim tries again and erases the account", async () => {
      const m = await memberWithGrocery();
      let deletion: Promise<unknown> = Promise.resolve();
      let releaseRecipe = () => {};
      let recipeHolder: Promise<unknown> = Promise.resolve();
      const recipeHeld = new Promise<number>((resolveHeld) => {
        const gate = new Promise<void>((resolve) => (releaseRecipe = resolve));

        recipeHolder = getTestDb().transaction(async (tx) => {
          await tx.select().from(recipes).where(eq(recipes.id, m.recipe.id)).for("update");
          resolveHeld(
            (await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`)).rows[0]!.pid
          );
          await gate;
        });
      });
      const blockedBy = async (pid: number, blocker: number) =>
        (await lockWaits()).get(pid)?.includes(blocker) || undefined;

      // The deletion holds the household and waits on the recipe while the test's write, holding
      // the line, waits on the household; let go, the deletion's wait on the line closes the cycle.
      await getTestDb().transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL deadlock_timeout = '10s'`);
        await tx.select().from(groceries).where(eq(groceries.id, m.grocery.id)).for("update");
        const holder = (await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`))
          .rows[0]!.pid;
        const recipePid = await recipeHeld;

        deletion = deleteAccount(m.deleted);
        deletion.catch(() => undefined);
        const deleter = await waitFor(
          async () =>
            [...(await lockWaits())].find(([, blockers]) => blockers.includes(recipePid))?.[0],
          "the deletion to wait on the recipe"
        );
        const keyShare = tx
          .select()
          .from(households)
          .where(eq(households.id, m.household))
          .for("key share")
          .execute();

        await waitFor(() => blockedBy(holder, deleter), "the write to wait on the deletion");
        releaseRecipe();
        await recipeHolder;
        await waitFor(() => blockedBy(deleter, holder), "the deletion to wait on the line");
        await keyShare;
      });

      await expect(deletion).resolves.toEqual(
        expect.objectContaining({ recipeIds: [m.recipe.id] })
      );
      expect(await getTestDb().select().from(users).where(eq(users.id, m.deleted))).toEqual([]);
    });
  });

  it("finds nothing to erase for an account already gone", async () => {
    const user = (await createTestUser())!.id;

    await deleteAccount(user);

    expect(await deleteAccount(user)).toEqual({
      householdId: null,
      householdErased: false,
      successorId: null,
      memberIds: [],
      recipeIds: [],
      cookbookIds: [],
      notes: [],
    });
  });
});
