// @vitest-environment node
/**
 * The Cuisine vocabulary is seeded by a versioned migration, not by a
 * boot-time reconcile.
 *
 * That distinction is the whole point of administrator ownership, so it is
 * tested through the migration runner the server actually uses rather than
 * through the repository: applying migrations a second time is what a restart
 * does, and a Cuisine an administrator deleted must not come back.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  generateTestDbName,
  teardownTestDatabase,
} from "../../../helpers/db-setup";

const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../src/migrations"
);

describe("Cuisine vocabulary seed", () => {
  const testDbName = generateTestDbName("test_cuisine_seed");
  let pool: pg.Pool;
  let testDbUrl: string;

  async function applyMigrations(): Promise<void> {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  }

  async function cuisineNames(): Promise<string[]> {
    const result = await pool.query<{ name: string }>("SELECT name FROM cuisines ORDER BY name");

    return result.rows.map((row) => row.name);
  }

  beforeAll(async () => {
    testDbUrl = await createTestDatabase(testDbName);
    pool = new pg.Pool({ connectionString: testDbUrl });
    await applyMigrations();
  }, 120_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("seeds a starting vocabulary", async () => {
    expect(await cuisineNames()).toContain("Italian");
  });

  it("does not duplicate the vocabulary when migrations are applied again", async () => {
    const before = await cuisineNames();

    await applyMigrations();

    expect(await cuisineNames()).toEqual(before);
  });

  it("does not restore a Cuisine an administrator deleted", async () => {
    await pool.query("DELETE FROM cuisines WHERE name = 'Italian'");

    await applyMigrations();

    expect(await cuisineNames()).not.toContain("Italian");
  });
});
