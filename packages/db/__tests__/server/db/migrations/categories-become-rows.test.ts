// @vitest-environment node
/**
 * Categories leave the `recipe_category` enum for rows (ADR-0040).
 *
 * Run against a database migrated up to the migration before it and seeded
 * with recipes as they stood: every recipe keeps the Categories it had.
 */

import { randomUUID } from "node:crypto";
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
const MIGRATION_TAG = "0085_categories_become_rows";

describe("categories becoming rows", () => {
  const testDbName = generateTestDbName("test_categories_become_rows");
  let pool: pg.Pool;

  const recipes = {
    two: randomUUID(),
    one: randomUUID(),
    none: randomUUID(),
  };

  async function applyMigration(tag: string): Promise<void> {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() === "") continue;

      await pool.query(statement);
    }
  }

  async function categoriesOf(recipeId: string): Promise<string[]> {
    const result = await pool.query<{ name: string }>(
      `SELECT c.name FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
       WHERE rc.recipe_id = $1 ORDER BY rc."order"`,
      [recipeId]
    );

    return result.rows.map((row) => row.name);
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: await createTestDatabase(testDbName) });

    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const migrationIndex = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

    expect(migrationIndex).toBeGreaterThan(0);

    for (const entry of journal.entries.slice(0, migrationIndex)) {
      await applyMigration(entry.tag);
    }

    const insertRecipe = (id: string, categories: string) =>
      pool.query(
        "INSERT INTO recipes (id, name, categories) VALUES ($1, 'Recipe', $2::recipe_category[])",
        [id, categories]
      );

    await insertRecipe(recipes.two, "{Dinner,Breakfast}");
    await insertRecipe(recipes.one, "{Snack}");
    await insertRecipe(recipes.none, "{}");

    await applyMigration(MIGRATION_TAG);
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("keeps every recipe's categories, in their order", async () => {
    expect(await categoriesOf(recipes.two)).toEqual(["Dinner", "Breakfast"]);
    expect(await categoriesOf(recipes.one)).toEqual(["Snack"]);
    expect(await categoriesOf(recipes.none)).toEqual([]);
  });

  it("seeds the four built-ins", async () => {
    const result = await pool.query<{ name: string }>("SELECT name FROM categories ORDER BY name");

    expect(result.rows.map((row) => row.name)).toEqual(["Breakfast", "Dinner", "Lunch", "Snack"]);
  });

  it("drops the old column and the enum", async () => {
    const column = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'categories'`
    );
    const enumType = await pool.query(`SELECT 1 FROM pg_type WHERE typname = 'recipe_category'`);

    expect(column.rowCount).toBe(0);
    expect(enumType.rowCount).toBe(0);
  });
});
