/**
 * Base class for repository tests that need a clean database setup
 *
 * Provides reusable setup/teardown logic for:
 * - Creating isolated test databases
 * - Managing database connections
 * - Cleaning up between tests
 *
 * Usage:
 * ```typescript
 * class MyRepositoryTest extends RepositoryTestBase {
 *   constructor() {
 *     super('my_repository');
 *   }
 * }
 *
 * const testBase = new MyRepositoryTest();
 *
 * beforeAll(async () => await testBase.setup());
 * beforeEach(async () => await testBase.beforeEachTest());
 * afterAll(async () => await testBase.teardown());
 * ```
 */

import { resetDbConnection } from "@/server/db/drizzle";
import { SERVER_CONFIG } from "@/config/env-config-server";
import {
  initTestDb,
  closeTestDb,
  cleanDatabase,
  createTestUser,
  createTestRecipe,
} from "@/__tests__/helpers/db-test-helpers";
import {
  setupTestDatabase,
  teardownTestDatabase,
  generateTestDbName,
} from "@/__tests__/helpers/db-setup";
import { FullRecipeDTO, User } from "@/types";

export class RepositoryTestBase {
  protected testDbName: string;
  protected testDbUrl: string;
  protected originalDatabaseUrl: string;
  private dbNamePrefix: string;

  constructor(dbNamePrefix: string) {
    this.dbNamePrefix = dbNamePrefix;
    this.testDbName = "";
    this.testDbUrl = "";
    this.originalDatabaseUrl = "";
  }

  /**
   * Call this in beforeAll()
   */
  async setup(): Promise<void> {
    // Save original DATABASE_URL
    this.originalDatabaseUrl = SERVER_CONFIG.DATABASE_URL;

    // Generate unique database name for this test suite
    this.testDbName = generateTestDbName(this.dbNamePrefix);

    // Create database and run migrations
    this.testDbUrl = await setupTestDatabase(this.testDbName);

    // Update SERVER_CONFIG to point to test database
    (SERVER_CONFIG as any).DATABASE_URL = this.testDbUrl;

    // Reset the global db connection to pick up the new SERVER_CONFIG.DATABASE_URL
    await resetDbConnection();

    // Initialize test database connection
    initTestDb(this.testDbUrl);
  }

  /**
   * Call this in beforeEach()
   */
  async beforeEachTest(): Promise<[User, FullRecipeDTO]> {
    // Clean database before each test
    await cleanDatabase();

    const user = await createTestUser();

    const recipe = await createTestRecipe(user.id, {
      name: "Test Recipe",
    });

    return [user, recipe];
  }

  /**
   * Call this in afterAll()
   */
  async teardown(): Promise<void> {
    // Close test database connection first
    await closeTestDb();

    // Reset global db connection to release pool connections
    await resetDbConnection();

    // Drop the test database (after all connections closed)
    await teardownTestDatabase(this.testDbName);

    // Restore original DATABASE_URL
    (SERVER_CONFIG as any).DATABASE_URL = this.originalDatabaseUrl;

    // Reset connection back to original
    await resetDbConnection();

    // Note: Container will be reused across test runs
    // It will be stopped when all tests complete or manually with `docker stop`
  }
}
