// @vitest-environment node
/**
 * Database setup utilities for tests
 *
 * Automatically manages PostgreSQL via Docker using testcontainers
 * Falls back to existing DATABASE_URL if Docker is not available
 */

import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

import { dbLogger } from "@/server/logger";

const { Client } = pg;

let _container: StartedPostgreSqlContainer | null = null;

/**
 * Get or create PostgreSQL connection details
 * Always uses testcontainers to spin up PostgreSQL in Docker
 */
async function getPostgresConnection(): Promise<{
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
}> {
  // Start a PostgreSQL container if not already running
  if (!_container) {
    dbLogger.info("Starting PostgreSQL container for tests...");

    try {
      _container = await new PostgreSqlContainer("postgres:15-alpine")
        .withExposedPorts(5432)
        .withUsername("test")
        .withPassword("test")
        .withDatabase("postgres")
        .withReuse() // Reuse container across test runs
        .start();

      dbLogger.info(
        {
          host: _container.getHost(),
          port: _container.getPort(),
          database: _container.getDatabase(),
        },
        "PostgreSQL container started"
      );
    } catch (error) {
      dbLogger.error({ error }, "Failed to start PostgreSQL container");
      throw new Error(
        "Failed to start PostgreSQL container. Is Docker running?\n" +
          "Run 'docker ps' to verify Docker is running."
      );
    }
  }

  return {
    user: _container.getUsername(),
    password: _container.getPassword(),
    host: _container.getHost(),
    port: _container.getPort(),
    database: _container.getDatabase(),
  };
}

/**
 * Create a test database
 */
export async function createTestDatabase(testDbName: string) {
  const config = await getPostgresConnection();

  // Connect to base database to create the test database
  const adminClient = new Client({
    user: config.user,
    password: config.password,
    host: config.host,
    port: config.port,
    database: config.database,
  });

  try {
    await adminClient.connect();

    // Drop the database if it exists (cleanup from previous failed runs)
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}"`);

    // Create the test database
    await adminClient.query(`CREATE DATABASE "${testDbName}"`);

    dbLogger.info({ testDbName }, "Test database created");
  } finally {
    await adminClient.end();
  }

  // Return connection string for the test database
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${testDbName}`;
}

/**
 * Drop a test database
 */
export async function dropTestDatabase(testDbName: string) {
  const config = await getPostgresConnection();

  // Connect to base database to drop the test database
  const adminClient = new Client({
    user: config.user,
    password: config.password,
    host: config.host,
    port: config.port,
    database: config.database,
  });

  try {
    await adminClient.connect();

    // Terminate existing connections to the database
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${testDbName}'
        AND pid <> pg_backend_pid()
    `);

    // Drop the test database
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDbName}"`);

    dbLogger.info({ testDbName }, "Test database dropped");
  } finally {
    await adminClient.end();
  }
}

/**
 * Run database migrations on a test database
 */
export async function runMigrations(testDbUrl: string) {
  const { execSync } = await import("child_process");

  try {
    // Run drizzle-kit push directly (skip db:ensure since testcontainers already created the DB)
    execSync("pnpm exec drizzle-kit push --config ./server/db/drizzle.config.ts", {
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
        SKIP_ENV_VALIDATION: "1",
      },
      stdio: "pipe",
    });

    dbLogger.info("Database migrations applied");
  } catch (error) {
    dbLogger.error({ error }, "Failed to run migrations");
    throw error;
  }
}

/**
 * Setup test database suite
 * Call this in beforeAll() or globalSetup
 */
export async function setupTestDatabase(testDbName: string) {
  // Create the database
  const testDbUrl = await createTestDatabase(testDbName);

  // Run migrations to create schema
  await runMigrations(testDbUrl);

  return testDbUrl;
}

/**
 * Teardown test database suite
 * Call this in afterAll() or globalTeardown
 */
export async function teardownTestDatabase(testDbName: string) {
  await dropTestDatabase(testDbName);
}

/**
 * Stop the PostgreSQL container (if started by testcontainers)
 * Call this at the very end of all test suites
 */
export async function stopPostgresContainer() {
  if (_container) {
    dbLogger.info("Stopping PostgreSQL container...");
    await _container.stop();
    _container = null;
    dbLogger.info("PostgreSQL container stopped");
  }
}

/**
 * Generate a unique test database name
 * Useful for parallel test execution
 */
export function generateTestDbName(baseName: string = "test_norish") {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);

  return `${baseName}_${timestamp}_${random}`;
}
