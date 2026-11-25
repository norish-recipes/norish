// @vitest-environment node
/**
 * Migration 0091 on stored policies of earlier releases: `owner` becomes `household`, edit and
 * delete never reach further than view, the Ingredient policy row goes; a second run changes nothing.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
const MIGRATION_TAG = "0091_permission_policy_levels";

describe("the Permission Policy is Everyone or Household", () => {
  const testDbName = generateTestDbName("test_policy_levels");
  let pool: pg.Pool;

  async function apply(tag: string) {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() !== "") await pool.query(statement);
    }
  }

  async function migratedPolicy(stored: unknown) {
    await pool.query("DELETE FROM server_config");
    await pool.query(
      `INSERT INTO server_config (id, key, value) VALUES
       ('a', 'recipe_permission_policy', $1), ('b', 'ingredient_permission_policy', '{"edit":"owner"}'),
       ('c', 'registration_enabled', 'true')`,
      [JSON.stringify(stored)]
    );
    await apply(MIGRATION_TAG);

    const { rows } = await pool.query("SELECT key, value FROM server_config ORDER BY key");

    return rows;
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: await createTestDatabase(testDbName) });
    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const index = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

    expect(index).toBeGreaterThan(0);
    for (const entry of journal.entries.slice(0, index)) await apply(entry.tag);
  });

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it.each([
    [
      "turns owner into household",
      { view: "owner", edit: "owner", delete: "owner" },
      { view: "household", edit: "household", delete: "household" },
    ],
    [
      "narrows edit and delete to view",
      { view: "household", edit: "everyone", delete: "everyone" },
      { view: "household", edit: "household", delete: "household" },
    ],
    [
      "keeps a policy that was already valid",
      { view: "everyone", edit: "everyone", delete: "household" },
      { view: "everyone", edit: "everyone", delete: "household" },
    ],
    [
      "fills a missing level with its default",
      { edit: "owner" },
      { view: "everyone", edit: "household", delete: "household" },
    ],
  ])("%s, drops the Ingredient policy and leaves other settings", async (_, stored, expected) => {
    expect(await migratedPolicy(stored)).toEqual([
      { key: "recipe_permission_policy", value: expected },
      { key: "registration_enabled", value: true },
    ]);
  });

  it("changes nothing on a second run", async () => {
    const first = await migratedPolicy({ view: "owner", edit: "everyone", delete: "owner" });

    await apply(MIGRATION_TAG);

    const { rows } = await pool.query("SELECT key, value FROM server_config ORDER BY key");

    expect(rows).toEqual(first);
  });
});
