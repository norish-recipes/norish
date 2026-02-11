// @vitest-environment node
/**
 * Database test helpers for repository tests
 *
 * These helpers provide utilities to set up and tear down test data
 * in a PostgreSQL database for integration tests.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { FullRecipeDTO, MeasurementSystem } from "@/types";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "@/server/db/schema";
import { getRecipeFull } from "@/server/db";
import { encrypt } from "@/server/auth/crypto";

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
  await db.delete(schema.recipeRatings);
  await db.delete(schema.recipeFavorites);
  await db.delete(schema.recipes);
  await db.delete(schema.ingredients);
  await db.delete(schema.plannedItems);
  await db.delete(schema.groceries);
  await db.delete(schema.recurringGroceries);
  await db.delete(schema.householdUsers);
  await db.delete(schema.households);
  await db.delete(schema.users);
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

  return ingredient;
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

/**
 * Create test recipe ingredients
 */
export async function createTestRecipeIngredients(
  recipeId: string,
  ingredientId: string,
  systemUsed: MeasurementSystem,
  overrides: Partial<typeof schema.recipeIngredients.$inferInsert> = {}
) {
  const db = getTestDb();

  const [recipeIngredient] = await db
    .insert(schema.recipeIngredients)
    .values({
      recipeId,
      ingredientId,
      amount: overrides.amount ?? "1",
      unit: overrides.unit ?? "cup",
      order: overrides.order ?? "0",
      systemUsed,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    })
    .returning();

  return recipeIngredient;
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

  return await db
    .select()
    .from(schema.recipeIngredients)
    .where(sql`${schema.recipeIngredients.recipeId} = ${recipeId}`);
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
