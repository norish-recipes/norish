// @vitest-environment node
/**
 * Database test helpers for repository tests
 *
 * These helpers provide utilities to set up and tear down test data
 * in a PostgreSQL database for integration tests.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import type { MintIngredientInput } from "@norish/db/repositories/ingredient-aliases";
import type { FullRecipeDTO, MeasurementSystem } from "@norish/shared/contracts";
import type { GroceryInsertDto } from "@norish/shared/contracts/dto/groceries";
import { encrypt, hashToken } from "@norish/config/crypto";
import { getRecipeFull } from "@norish/db";
import { createGroceries, deleteGroceryByIds } from "@norish/db/repositories/groceries";
import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import { isFirstLineFood, writeRecipeLineFoodsTx } from "@norish/db/repositories/ingredients";
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

/**
 * Create a test ingredient
 */
export async function createTestIngredient(
  overrides: Partial<typeof schema.ingredients.$inferInsert> = {}
) {
  const db = getTestDb();

  const [ingredient] = await db
    .insert(schema.ingredients)
    .values({
      name: overrides.name ?? `Test Ingredient ${Date.now()}`,
      createdAt: overrides.createdAt ?? new Date(),
    })
    .returning();

  // Its own name as its first alias, as every Ingredient has.
  await db.insert(schema.ingredientAliases).values({
    text: ingredient!.name,
    fold: ingredient!.name.toLowerCase(),
    ingredientId: ingredient!.id,
  });

  return ingredient;
}

/** A food Norish knows by one spelling, minted as the resolver would; shared, unflagged. */
export async function mintTestFood(
  text: string,
  options: Partial<Omit<MintIngredientInput, "name" | "aliases">> = {}
) {
  const [row] = await mintIngredientWithAliases({
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
    .where(sql`${schema.recipeIngredients.recipeId} = ${recipeId}`);

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

  return await db
    .select()
    .from(schema.steps)
    .where(sql`${schema.steps.recipeId} = ${recipeId}`);
}

/**
 * Verify database connection
 */
export async function verifyDatabaseConnection() {
  const db = getTestDb();

  try {
    await db.execute(sql`SELECT 1`);

    return true;
  } catch {
    return false;
  }
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
export async function addTestGrocery(userId: string, fields: GroceryFields = {}) {
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
    householdId
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
