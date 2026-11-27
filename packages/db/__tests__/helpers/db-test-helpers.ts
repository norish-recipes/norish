// @vitest-environment node
/**
 * Database test helpers for repository tests
 *
 * These helpers provide utilities to set up and tear down test data
 * in a PostgreSQL database for integration tests.
 */

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import type { DbTransaction } from "@norish/db/drizzle";
import type { MintIngredientInput } from "@norish/db/repositories/ingredient-aliases";
import type { FullRecipeDTO, MeasurementSystem } from "@norish/shared/contracts";
import type { GroceryInsertDto } from "@norish/shared/contracts/dto/groceries";
import { encrypt, hashToken } from "@norish/config/crypto";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { getRecipeFull } from "@norish/db";
import { withTransaction } from "@norish/db/drizzle";
import { createGroceries, deleteGroceryByIds } from "@norish/db/repositories/groceries";
import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import { isFirstLineFood, writeRecipeLineFoodsTx } from "@norish/db/repositories/ingredients";
import { appendRecipeEntriesTx } from "@norish/db/repositories/list-entries";
import { addPantryIngredients } from "@norish/db/repositories/pantry";
import { createRecurringGroceries } from "@norish/db/repositories/recurring-groceries";
import * as schema from "@norish/db/schema";
import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

const { Pool } = pg;

export type TestDb = NodePgDatabase<typeof schema>;

let _testDb: TestDb | null = null;
let _testPool: pg.Pool | null = null;

/**
 * Initialize test database connection
 * Call this in beforeAll with the test database URL
 */
export function initTestDb(testDbUrl: string): TestDb {
  if (_testDb) {
    return _testDb;
  }

  _testPool = new Pool({ connectionString: testDbUrl });
  _testDb = drizzle(_testPool, { schema });

  return _testDb;
}

/**
 * Close test database connection
 * Call this in afterAll
 */
export async function closeTestDb() {
  if (_testPool) {
    await _testPool.end();
    _testPool = null;
    _testDb = null;
  }
}

/**
 * Get the test database instance
 */
export function getTestDb(): TestDb {
  if (!_testDb) {
    throw new Error("Test database not initialized. Call initTestDb() first.");
  }

  return _testDb;
}

/**
 * Clean all test data from the database
 * Should be called in afterEach or afterAll
 */
export async function cleanDatabase() {
  const db = getTestDb();

  // Delete in correct order due to foreign key constraints
  await db.delete(schema.recipeVideos);
  await db.delete(schema.recipeImages);
  await db.delete(schema.steps);
  await db.delete(schema.recipeIngredients);
  await db.delete(schema.recipeTags);
  await db.delete(schema.tags);
  // The cuisines themselves survive: they are a migration-seeded vocabulary,
  // not per-test fixture data.
  await db.delete(schema.recipeCuisines);
  await db.delete(schema.recipeRatings);
  await db.delete(schema.recipeFavorites);
  await db.delete(schema.recipeShares);
  await db.delete(schema.cookbookRecipes);
  await db.delete(schema.cookbooks);
  await db.delete(schema.recipes);
  // The built-in Categories are migration-seeded and stay.
  await db
    .delete(schema.categories)
    .where(notInArray(schema.categories.name, [...BUILT_IN_CATEGORIES]));
  // Groceries point at Ingredient Aliases, which go with their Ingredients.
  await db.delete(schema.groceries);
  await db.delete(schema.recurringGroceries);
  // A deleted food's AI Changes name no food, so they do not go with the Ingredients.
  await db.delete(schema.ingredientJunkPile);
  await db.delete(schema.ingredientAIChanges);
  await db.delete(schema.ingredients);
  await db.delete(schema.plannedItems);
  await db.delete(schema.householdUsers);
  await db.delete(schema.households);
  await db.delete(schema.users);
}

// Each test user's household, for the synchronous viewers tests build.
const testHouseholds = new Map<string, string>();

/** The household a user made by `createTestUser` is in, as last moved by `joinTestHousehold`. */
export function testHouseholdOf(userId: string): string {
  const householdId = testHouseholds.get(userId);

  if (!householdId) throw new Error(`${userId} was not made by createTestUser`);

  return householdId;
}

/** Moves a test user, and what they own, into another user's household; theirs of one goes. */
export async function joinTestHousehold(userId: string, hostId: string): Promise<string> {
  const householdId = testHouseholdOf(hostId);
  const db = getTestDb();

  await db
    .update(schema.householdUsers)
    .set({ householdId })
    .where(eq(schema.householdUsers.userId, userId));
  await db.delete(schema.households).where(eq(schema.households.id, testHouseholdOf(userId)));
  testHouseholds.set(userId, householdId);

  return householdId;
}

/** Puts the Tag or Category `name` on each recipe, from the recipe's household's list (ADR-0043). */
export async function attachTestEntry(
  kind: "tag" | "category",
  recipeIds: readonly string[],
  name: string
): Promise<void> {
  for (const recipeId of recipeIds) {
    await getTestDb().transaction((tx) => appendRecipeEntriesTx(tx, kind, recipeId, [name]));
  }
}

/**
 * Create a test user
 */
export async function createTestUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  const db = getTestDb();

  const [user] = await db
    .insert(schema.users)
    .values({
      id: overrides.id ?? `test-user-${Date.now()}-${Math.random()}`,
      name: encrypt(overrides.name ?? "Test User"),
      email: encrypt(overrides.email ?? `test-${Date.now()}@example.com`),
      emailVerified: overrides.emailVerified ?? false,
      image: overrides.image ?? null,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    })
    .returning();

  testHouseholds.set(user!.id, await householdIdOf(user!.id));

  return user;
}

/**
 * Create a test household
 */
export async function createTestHousehold(
  adminUserId: string,
  overrides: Partial<typeof schema.households.$inferInsert> = {}
) {
  const db = getTestDb();

  const [household] = await db
    .insert(schema.households)
    .values({
      id: overrides.id ?? `test-household-${Date.now()}-${Math.random()}`,
      name: overrides.name ?? "Test Household",
      adminUserId: overrides.adminUserId ?? adminUserId,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    })
    .returning();

  return household;
}

/** A test ingredient: a seeded food, unless it is given a household (ADR-0042). */
export async function createTestIngredient(
  overrides: Partial<typeof schema.ingredients.$inferInsert> = {}
) {
  const db = getTestDb();
  const householdId = overrides.householdId ?? null;

  const [ingredient] = await db
    .insert(schema.ingredients)
    .values({
      name: overrides.name ?? `Test Ingredient ${Date.now()}`,
      createdAt: overrides.createdAt ?? new Date(),
      householdId,
      offId: householdId ? null : (overrides.offId ?? `test:${randomUUID()}`),
    })
    .returning();

  // Its own name as its first alias, as every Ingredient has.
  await db.insert(schema.ingredientAliases).values({
    householdId,
    text: ingredient!.name,
    fold: ingredient!.name.toLowerCase(),
    ingredientId: ingredient!.id,
  });

  return ingredient;
}

/** Set columns of test Ingredients as a scenario needs them: a flag, a parent, a mark. */
export async function setTestIngredients(
  ids: string | readonly string[],
  values: Partial<typeof schema.ingredients.$inferInsert>
): Promise<void> {
  await getTestDb()
    .update(schema.ingredients)
    .set(values)
    .where(inArray(schema.ingredients.id, typeof ids === "string" ? [ids] : [...ids]));
}

/** One Ingredient as stored, or null once it is gone. */
export async function readTestIngredient(id: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, id));

  return row ?? null;
}

/** Every Ingredient named exactly this, as stored. */
export async function listTestIngredientsNamed(name: string) {
  return await getTestDb()
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.name, name));
}

/** The Ingredient named exactly this, as stored, or null. */
export async function readTestIngredientNamed(name: string) {
  const [row] = await listTestIngredientsNamed(name);

  return row ?? null;
}

/** The seed's spelling of a fold, as stored, or null. */
export async function readTestSeedSpelling(fold: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.ingredientAliases)
    .where(
      and(eq(schema.ingredientAliases.fold, fold), isNull(schema.ingredientAliases.householdId))
    );

  return row ?? null;
}

/** A seeded spelling written onto a seeded food, as an earlier seed left one; its id. */
export async function addTestSeedSpelling(ingredientId: string, text: string, locale: string) {
  const [row] = await getTestDb()
    .insert(schema.ingredientAliases)
    .values({ ingredientId, text, fold: ingredientAliasFold(text), locale, seeded: true })
    .returning({ id: schema.ingredientAliases.id });

  return row!.id;
}

/**
 * Give a food one more spelling: its household's by default, or the one given (null: the seed's,
 * not marked seeded, as a seeded food gains one after the seed); its id.
 */
export async function addTestSpelling(
  ingredientId: string,
  text: string,
  { locale = null, householdId }: { locale?: string | null; householdId?: string | null } = {}
): Promise<string> {
  const [food] = await getTestDb()
    .select({ householdId: schema.ingredients.householdId })
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, ingredientId));
  const [row] = await getTestDb()
    .insert(schema.ingredientAliases)
    .values({
      ingredientId,
      text,
      fold: ingredientAliasFold(text),
      locale,
      householdId: householdId === undefined ? (food?.householdId ?? null) : householdId,
    })
    .returning({ id: schema.ingredientAliases.id });

  return row!.id;
}

/** Give the seed's spelling of a fold another language, as an earlier seed stamped it. */
export async function setTestSeedSpellingLocale(fold: string, locale: string): Promise<void> {
  await getTestDb()
    .update(schema.ingredientAliases)
    .set({ locale })
    .where(
      and(eq(schema.ingredientAliases.fold, fold), isNull(schema.ingredientAliases.householdId))
    );
}

/** A household's Ingredient with no spelling at all, as a row from before the catalogue; its id. */
export async function createTestBareIngredient(name: string, householdId: string): Promise<string> {
  const [row] = await getTestDb()
    .insert(schema.ingredients)
    .values({ name, householdId })
    .returning({ id: schema.ingredients.id });

  return row!.id;
}

/** A Store aisle, as the Store editor saves one. */
export async function createTestAisle(storeId: string, name: string) {
  const [row] = await getTestDb().insert(schema.aisles).values({ storeId, name }).returning();

  return row!;
}

/** File a food in a Store's aisle. */
export async function addTestAisleLink(values: typeof schema.aisleLinks.$inferInsert) {
  await getTestDb().insert(schema.aisleLinks).values(values);
}

/** An Aisle Link as stored, by id, or null. */
export async function readTestAisleLink(id: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.aisleLinks)
    .where(eq(schema.aisleLinks.id, id));

  return row ?? null;
}

/** A Product Link as stored, by id, or null. */
export async function readTestProductLink(id: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.storeProductLinks)
    .where(eq(schema.storeProductLinks.id, id));

  return row ?? null;
}

/** A link migration 0075 parked, as the upgrade finds it; its id. */
export async function parkTestLink(
  id: string,
  kind: typeof schema.parkedNameKeyedLinks.$inferInsert.kind,
  link: typeof schema.parkedNameKeyedLinks.$inferInsert.link
): Promise<string> {
  await getTestDb().insert(schema.parkedNameKeyedLinks).values({ id, kind, link });

  return id;
}

/** Every Ingredient as stored. */
export async function listTestIngredients() {
  return await getTestDb().select().from(schema.ingredients);
}

/** A spelling of this fold as stored, any household's or the seed's, or null. */
export async function readTestSpellingByFold(fold: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.ingredientAliases)
    .where(eq(schema.ingredientAliases.fold, fold));

  return row ?? null;
}

/** The spellings a recipe line names, in order. */
export async function testLineAliasIds(lineId: string): Promise<string[]> {
  const rows = await getTestDb()
    .select({ aliasId: schema.recipeIngredientFoods.ingredientAliasId })
    .from(schema.recipeIngredientFoods)
    .where(eq(schema.recipeIngredientFoods.recipeIngredientId, lineId))
    .orderBy(asc(schema.recipeIngredientFoods.position));

  return rows.map((row) => row.aliasId);
}

/** The texts of a recipe's lines, in their order. */
export async function testRecipeLineNames(recipeId: string): Promise<string[]> {
  const rows = await getTestDb()
    .select({ name: schema.recipeIngredients.name })
    .from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.recipeId, recipeId))
    .orderBy(asc(schema.recipeIngredients.order));

  return rows.map((row) => row.name);
}

/** The ids of every recipe line, in any recipe, of exactly this text. */
export async function listTestRecipeLinesNamed(name: string): Promise<string[]> {
  const rows = await getTestDb()
    .select({ id: schema.recipeIngredients.id })
    .from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.name, name));

  return rows.map((row) => row.id);
}

/** One recipe line as stored, or null once it is gone. */
export async function readTestRecipeLine(id: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.id, id));

  return row ?? null;
}

/** One spelling as stored, or null once it is gone. */
export async function readTestSpelling(id: string) {
  const [row] = await getTestDb()
    .select()
    .from(schema.ingredientAliases)
    .where(eq(schema.ingredientAliases.id, id));

  return row ?? null;
}

/** How many foods and spellings every catalogue holds together. */
export async function countTestCatalogueRows() {
  const db = getTestDb();
  const [foods, spellings] = await Promise.all([
    db.select({ id: schema.ingredients.id }).from(schema.ingredients),
    db.select({ id: schema.ingredientAliases.id }).from(schema.ingredientAliases),
  ]);

  return { foods: foods.length, spellings: spellings.length };
}

/** Every Ingredient's id: how many foods the catalogue holds. */
export async function listTestIngredientIds(): Promise<string[]> {
  const rows = await getTestDb().select({ id: schema.ingredients.id }).from(schema.ingredients);

  return rows.map((row) => row.id);
}

/** The foods a recipe line names, in order. */
export async function testLineFoods(lineId: string): Promise<string[]> {
  const rows = await getTestDb()
    .select({ ingredientId: schema.ingredientAliases.ingredientId })
    .from(schema.recipeIngredientFoods)
    .innerJoin(
      schema.ingredientAliases,
      eq(schema.ingredientAliases.id, schema.recipeIngredientFoods.ingredientAliasId)
    )
    .where(eq(schema.recipeIngredientFoods.recipeIngredientId, lineId))
    .orderBy(asc(schema.recipeIngredientFoods.position));

  return rows.map((row) => row.ingredientId);
}

/** The foods a recipe line names, by name and the spelling it names them by, in order. */
export async function testLineFoodNames(lineId: string) {
  return await getTestDb()
    .select({ food: schema.ingredients.name, spelling: schema.ingredientAliases.text })
    .from(schema.recipeIngredientFoods)
    .innerJoin(
      schema.ingredientAliases,
      eq(schema.ingredientAliases.id, schema.recipeIngredientFoods.ingredientAliasId)
    )
    .innerJoin(schema.ingredients, eq(schema.ingredients.id, schema.ingredientAliases.ingredientId))
    .where(eq(schema.recipeIngredientFoods.recipeIngredientId, lineId))
    .orderBy(asc(schema.recipeIngredientFoods.position));
}

/** A recipe line's text and its first spelling, or undefined once it is gone. */
export async function testLineSpelling(lineId: string) {
  const [line] = await getTestDb()
    .select({
      name: schema.recipeIngredients.name,
      aliasId: schema.recipeIngredientFoods.ingredientAliasId,
    })
    .from(schema.recipeIngredients)
    .leftJoin(
      schema.recipeIngredientFoods,
      eq(schema.recipeIngredientFoods.recipeIngredientId, schema.recipeIngredients.id)
    )
    .where(eq(schema.recipeIngredients.id, lineId));

  return line;
}

/** Delete a recipe line, as an edit of its recipe would. */
export async function deleteTestRecipeLine(lineId: string): Promise<void> {
  await getTestDb().delete(schema.recipeIngredients).where(eq(schema.recipeIngredients.id, lineId));
}

/** Forget what the catalogue seed applied, so a scenario seeds from scratch. */
export async function clearTestSeedState(): Promise<void> {
  await getTestDb()
    .delete(schema.serverConfig)
    .where(eq(schema.serverConfig.key, ServerConfigKeys.INGREDIENT_SEED_STATE));
}

/** Date every AI Change `days` back, as though AI made them then. */
export async function backdateTestAIChanges(days: number): Promise<void> {
  await getTestDb()
    .update(schema.ingredientAIChanges)
    .set({ createdAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) });
}

/** Every AI Change as stored. */
export async function listTestAIChanges() {
  return await getTestDb().select().from(schema.ingredientAIChanges);
}

/** A household's food known by one spelling, minted as the resolver would; unflagged. */
export async function mintTestFood(
  householdId: string,
  text: string,
  options: Partial<Omit<MintIngredientInput, "householdId" | "name" | "aliases">> = {}
) {
  const {
    aliases: [row],
  } = await mintIngredientWithAliases({
    householdId,
    name: text,
    aliases: [{ text, fold: ingredientAliasFold(text) }],
    ownerId: null,
    locale: null,
    flagged: false,
    ...options,
  });

  return row!;
}

/**
 * Create a test recipe with basic fields
 */
export async function createTestRecipe(
  userId: string,
  overrides: Partial<typeof schema.recipes.$inferInsert> = {}
): Promise<FullRecipeDTO> {
  const db = getTestDb();

  const [recipe] = await db
    .insert(schema.recipes)
    .values({
      userId,
      name: overrides.name ?? `Test Recipe ${Date.now()}`,
      description: overrides.description ?? "Test recipe description",
      url: overrides.url ?? null,
      servings: overrides.servings ?? 4,
      prepMinutes: overrides.prepMinutes ?? 10,
      cookMinutes: overrides.cookMinutes ?? 20,
      totalMinutes: overrides.totalMinutes ?? 30,
      calories: overrides.calories ?? null,
      fat: overrides.fat ?? null,
      carbs: overrides.carbs ?? null,
      protein: overrides.protein ?? null,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    })
    .returning();

  return (await getRecipeFull(recipe.id))!;
}

export async function createTestRecipeShare(
  userId: string,
  recipeId: string,
  overrides: Partial<typeof schema.recipeShares.$inferInsert> & { token?: string } = {}
) {
  const db = getTestDb();
  const token = overrides.token ?? `share-token-${Date.now()}`;

  const [share] = await db
    .insert(schema.recipeShares)
    .values({
      userId,
      recipeId,
      tokenHash: overrides.tokenHash ?? hashToken(token),
      expiresAt: overrides.expiresAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
      lastAccessedAt: overrides.lastAccessedAt ?? null,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
      version: overrides.version ?? 1,
    })
    .returning();

  return { share, token };
}

/**
 * Create test recipe ingredients
 */
/** Insert a recipe line and the foods it names, in order, as the app writes them. */
export async function insertTestRecipeLine(
  values: typeof schema.recipeIngredients.$inferInsert,
  aliasIds: readonly string[] = []
) {
  const db = getTestDb();
  const [line] = await db.insert(schema.recipeIngredients).values(values).returning();

  if (aliasIds.length > 0) {
    await db.transaction((tx) => writeRecipeLineFoodsTx(tx, [{ id: line!.id, aliasIds }]));
  }

  return line!;
}

/** A new recipe of `userId`'s with a line naming `aliasId`: AI asks only about recipe foods. */
export async function nameInATestRecipe(userId: string, aliasId: string, text = "a line") {
  const recipe = await createTestRecipe(userId);

  return await insertTestRecipeLine({ recipeId: recipe.id, name: text }, [aliasId]);
}

export async function createTestRecipeIngredients(
  recipeId: string,
  ingredientId: string,
  systemUsed: MeasurementSystem,
  overrides: Partial<typeof schema.recipeIngredients.$inferInsert> = {}
) {
  const alias = await firstSpellingId(ingredientId);

  return await insertTestRecipeLine(
    {
      recipeId,
      name: overrides.name ?? "Test ingredient",
      amount: overrides.amount ?? "1",
      unit: overrides.unit ?? "cup",
      order: overrides.order ?? "0",
      systemUsed,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    },
    alias ? [alias] : []
  );
}

/** The id of an Ingredient's first spelling, if it has one. */
export async function firstSpellingId(ingredientId: string): Promise<string | undefined> {
  const [alias] = await getTestDb()
    .select({ id: schema.ingredientAliases.id })
    .from(schema.ingredientAliases)
    .where(eq(schema.ingredientAliases.ingredientId, ingredientId))
    .orderBy(schema.ingredientAliases.createdAt)
    .limit(1);

  return alias?.id;
}

/** An image on a recipe step, as the step editor stores one. */
export async function addTestStepImage(stepId: string, image: string) {
  await getTestDb().insert(schema.stepImages).values({ stepId, image, order: "0" });
}

/**
 * Create test recipe steps
 */
export async function createTestRecipeStep(
  recipeId: string,
  systemUsed: MeasurementSystem,
  overrides: Partial<typeof schema.steps.$inferInsert> = {}
) {
  const db = getTestDb();

  const [step] = await db
    .insert(schema.steps)
    .values({
      recipeId,
      step: overrides.step ?? `Test step ${Date.now()}`,
      order: overrides.order ?? "0",
      systemUsed,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    })
    .returning();

  return step;
}

/**
 * Get all recipe ingredients for a recipe
 */
export async function getRecipeIngredients(recipeId: string) {
  const db = getTestDb();

  // A line reaches its Ingredient through its first food's alias.
  const rows = await db
    .select({
      line: schema.recipeIngredients,
      ingredientId: schema.ingredientAliases.ingredientId,
    })
    .from(schema.recipeIngredients)
    .leftJoin(
      schema.recipeIngredientFoods,
      and(
        eq(schema.recipeIngredientFoods.recipeIngredientId, schema.recipeIngredients.id),
        isFirstLineFood()
      )
    )
    .leftJoin(
      schema.ingredientAliases,
      eq(schema.ingredientAliases.id, schema.recipeIngredientFoods.ingredientAliasId)
    )
    .where(eq(schema.recipeIngredients.recipeId, recipeId));

  return rows.map(({ line, ingredientId }) => ({ ...line, ingredientId }));
}

/** The texts of an Ingredient's spellings, sorted. */
export async function getSpellingTexts(ingredientId: string): Promise<string[]> {
  const rows = await getTestDb()
    .select({ text: schema.ingredientAliases.text })
    .from(schema.ingredientAliases)
    .where(eq(schema.ingredientAliases.ingredientId, ingredientId));

  return rows.map((row) => row.text).sort();
}

/**
 * Get all recipe steps for a recipe
 */
export async function getRecipeSteps(recipeId: string) {
  const db = getTestDb();

  return await db.select().from(schema.steps).where(eq(schema.steps.recipeId, recipeId));
}

/** The household every account is in from its first insert. */
export async function householdIdOf(userId: string): Promise<string> {
  const [row] = await getTestDb()
    .select({ householdId: schema.householdUsers.householdId })
    .from(schema.householdUsers)
    .where(eq(schema.householdUsers.userId, userId));

  if (!row) throw new Error(`No household for ${userId}`);

  return row.householdId;
}

type GroceryFields = Partial<Omit<GroceryInsertDto, "householdId" | "userId">>;

/** A grocery a member puts on their household's list, through the repository. */
export async function addTestGrocery(
  userId: string,
  fields: GroceryFields = {},
  tx?: Parameters<typeof createGroceries>[2]
) {
  const householdId = await householdIdOf(userId);
  const { created } = await createGroceries(
    [
      {
        id: crypto.randomUUID(),
        groceries: {
          name: null,
          unit: null,
          amount: null,
          isDone: false,
          recipeIngredientId: null,
          recurringGroceryId: null,
          ...fields,
          householdId,
          userId,
        },
      },
    ],
    householdId,
    tx
  );

  return created[0]!;
}

/** A recurring grocery a member adds, with the grocery it puts on the list unless `alone`. */
export async function addTestRecurringGrocery(
  userId: string,
  fields: {
    name: string;
    ingredientAliasId?: string | null;
    ingredientId?: string | null;
    nextPlannedFor?: string;
    alone?: boolean;
  }
) {
  const householdId = await householdIdOf(userId);
  const id = crypto.randomUUID();
  const food = { ingredientAliasId: fields.ingredientAliasId, ingredientId: fields.ingredientId };
  const { created } = await createRecurringGroceries(
    [
      {
        recurring: {
          id,
          householdId,
          userId,
          name: fields.name,
          ...food,
          amount: null,
          unit: null,
          recurrenceRule: "week",
          recurrenceInterval: 1,
          recurrenceWeekday: null,
          nextPlannedFor: fields.nextPlannedFor ?? "2027-01-01",
          lastCheckedDate: null,
        },
        grocery: {
          id: crypto.randomUUID(),
          groceries: {
            householdId,
            userId,
            name: fields.name,
            ...food,
            unit: null,
            amount: null,
            isDone: false,
            recipeIngredientId: null,
            recurringGroceryId: id,
          },
        },
      },
    ],
    householdId
  );
  const made = created[0]!;

  if (fields.alone) await deleteGroceryByIds([made.grocery], householdId);

  return made;
}

/** A food a member keeps in their household's Pantry, through the repository. */
export async function addTestPantryIngredient(
  userId: string,
  food: { ingredientId: string; ingredientAliasId?: string | null }
) {
  const [added] = await addPantryIngredients(
    [
      {
        id: crypto.randomUUID(),
        ingredientId: food.ingredientId,
        ingredientAliasId: food.ingredientAliasId ?? null,
      },
    ],
    { userId, householdId: await householdIdOf(userId) }
  );

  return added!.item;
}

/** What each of a member's household's groceries (or recurring groceries) names, by name. */
export async function testGroceryFoods(
  userId: string,
  kind: "groceries" | "recurring" = "groceries"
) {
  const table = kind === "groceries" ? schema.groceries : schema.recurringGroceries;
  const rows = await getTestDb()
    .select({
      id: table.id,
      name: table.name,
      aliasId: table.ingredientAliasId,
      ingredientId: table.ingredientId,
    })
    .from(table)
    .where(eq(table.householdId, await householdIdOf(userId)));

  return rows.sort(
    (a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.id.localeCompare(b.id)
  );
}

/** The spellings a member's household's Pantry rows point at, oldest first. */
export async function testPantrySpellings(userId: string) {
  const pantry = schema.pantryIngredients;

  return await getTestDb()
    .select({
      id: pantry.id,
      ingredientId: pantry.ingredientId,
      ingredientAliasId: pantry.ingredientAliasId,
    })
    .from(pantry)
    .where(eq(pantry.householdId, await householdIdOf(userId)))
    .orderBy(asc(pantry.createdAt), asc(pantry.id));
}

/** Recipes and cookbooks whose household is not their Owner's; there are never any. */
export async function rowsOutsideTheirOwnersHousehold(): Promise<string[]> {
  const strays: string[] = [];

  for (const table of [schema.recipes, schema.cookbooks]) {
    const rows = await getTestDb()
      .select({ id: table.id })
      .from(table)
      .leftJoin(
        schema.householdUsers,
        and(
          eq(schema.householdUsers.userId, table.userId),
          eq(schema.householdUsers.householdId, table.householdId)
        )
      )
      .where(isNull(schema.householdUsers.userId));

    strays.push(...rows.map((row) => row.id));
  }

  return strays;
}

/** A repository write that takes a transaction (`…Tx`, `tx` first), run in one as its callers do. */
export async function inRepositoryTransaction<T>(
  work: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return await withTransaction(work);
}
