// @vitest-environment node
/**
 * Database setup utilities for tests
 *
 * Automatically manages PostgreSQL via Docker using testcontainers
 * Falls back to existing DATABASE_URL if Docker is not available
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

import { dbLogger } from "@norish/db/logger";

const { Client } = pg;

let _container: StartedPostgreSqlContainer | null = null;
let _containerPromise: Promise<StartedPostgreSqlContainer> | null = null;

const CONNECTION_DRAIN_TIMEOUT_MS = 10_000;
const CONNECTION_DRAIN_POLL_MS = 25;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function countDatabaseConnections(client: pg.Client, testDbName: string): Promise<number> {
  const result = await client.query<{ count: number | string }>(
    `
      SELECT COUNT(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()
    `,
    [testDbName]
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function waitForDatabaseConnectionsToDrain(
  client: pg.Client,
  testDbName: string,
  timeoutMs = CONNECTION_DRAIN_TIMEOUT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if ((await countDatabaseConnections(client, testDbName)) === 0) {
      return true;
    }

    await sleep(CONNECTION_DRAIN_POLL_MS);
  }

  return (await countDatabaseConnections(client, testDbName)) === 0;
}

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
    _containerPromise ??= startPostgresContainer();
    _container = await _containerPromise;
  }

  return {
    user: _container.getUsername(),
    password: _container.getPassword(),
    host: _container.getHost(),
    port: _container.getPort(),
    database: _container.getDatabase(),
  };
}

async function startPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  dbLogger.info("Starting PostgreSQL container for tests...");

  try {
    const container = await new PostgreSqlContainer("postgres:15-alpine")
      .withExposedPorts(5432)
      .withUsername("test")
      .withPassword("test")
      .withDatabase("postgres")
      .withReuse() // Reuse container across test runs
      .start();

    dbLogger.info(
      {
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
      },
      "PostgreSQL container started"
    );

    return container;
  } catch (error) {
    _containerPromise = null;
    dbLogger.error({ error }, "Failed to start PostgreSQL container");
    throw new Error(
      "Failed to start PostgreSQL container. Is Docker running?\n" +
        "Run 'docker ps' to verify Docker is running."
    );
  }
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
    await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(testDbName)}`);

    // Create the test database
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(testDbName)}`);

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

    // Give pools that were just closed a chance to finish their socket shutdown
    // before force-terminating backends. Otherwise pg can emit late 57P01 errors.
    const drained = await waitForDatabaseConnectionsToDrain(adminClient, testDbName);

    if (!drained) {
      await adminClient.query(
        `
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = $1
            AND pid <> pg_backend_pid()
        `,
        [testDbName]
      );
      await waitForDatabaseConnectionsToDrain(adminClient, testDbName, CONNECTION_DRAIN_TIMEOUT_MS);
    }

    // Drop the test database
    await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(testDbName)}`);

    dbLogger.info({ testDbName }, "Test database dropped");
  } finally {
    await adminClient.end();
  }
}

/**
 * Run database migrations on a test database
 */
export async function runMigrations(testDbUrl: string) {
  const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/migrations");
  const client = new Client({ connectionString: testDbUrl });

  try {
    await client.connect();

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const sql = await readFile(resolve(migrationsDir, file), "utf8");

      await client.query(sql);
    }

    dbLogger.info("Database migrations applied");
  } catch (error) {
    dbLogger.error({ error }, "Failed to run migrations");
    throw error;
  } finally {
    await client.end();
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
    _containerPromise = null;
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
