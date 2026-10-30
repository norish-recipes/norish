// @vitest-environment node
/**
 * The old single recipe image moves into the gallery before its column goes.
 *
 * Run against a database migrated up to the migration before it and seeded
 * with recipes as they stood: the recipes must show the same picture after
 * the upgrade as before it.
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
const MIGRATION_TAG = "0074_recipe_image_into_gallery";

describe("the old recipe image moving into the gallery", () => {
  const testDbName = generateTestDbName("test_recipe_image_into_gallery");
  let pool: pg.Pool;

  const recipes = {
    legacyOnly: randomUUID(),
    galleryAndLegacy: randomUUID(),
    blankLegacy: randomUUID(),
    noImage: randomUUID(),
  };

  async function applyMigration(tag: string): Promise<void> {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() === "") continue;

      await pool.query(statement);
    }
  }

  async function gallery(recipeId: string): Promise<{ image: string; order: string }[]> {
    const result = await pool.query<{ image: string; order: string }>(
      `SELECT image, "order" FROM recipe_images WHERE recipe_id = $1 ORDER BY "order", image`,
      [recipeId]
    );

    return result.rows;
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: await createTestDatabase(testDbName) });

    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const migrationIndex = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

    for (const entry of journal.entries.slice(0, migrationIndex)) {
      await applyMigration(entry.tag);
    }

    const insertRecipe = (id: string, image: string | null) =>
      pool.query("INSERT INTO recipes (id, name, image) VALUES ($1, 'Recipe', $2)", [id, image]);

    await insertRecipe(recipes.legacyOnly, `/recipes/${recipes.legacyOnly}/old.jpg`);
    await insertRecipe(recipes.galleryAndLegacy, `/recipes/${recipes.galleryAndLegacy}/stale.jpg`);
    await pool.query(`INSERT INTO recipe_images (recipe_id, image, "order") VALUES ($1, $2, 0)`, [
      recipes.galleryAndLegacy,
      `/recipes/${recipes.galleryAndLegacy}/shown.jpg`,
    ]);
    await insertRecipe(recipes.blankLegacy, "  ");
    await insertRecipe(recipes.noImage, null);

    await applyMigration(MIGRATION_TAG);
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("gives a recipe whose only picture was the old image that picture as its first gallery image", async () => {
    expect(await gallery(recipes.legacyOnly)).toEqual([
      { image: `/recipes/${recipes.legacyOnly}/old.jpg`, order: "0" },
    ]);
  });

  it("leaves a gallery alone, since the old image behind it was never shown", async () => {
    expect(await gallery(recipes.galleryAndLegacy)).toEqual([
      { image: `/recipes/${recipes.galleryAndLegacy}/shown.jpg`, order: "0" },
    ]);
  });

  it("adds nothing for a blank or missing old image", async () => {
    expect(await gallery(recipes.blankLegacy)).toEqual([]);
    expect(await gallery(recipes.noImage)).toEqual([]);
  });

  it("drops the old column", async () => {
    const result = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'image'`
    );

    expect(result.rowCount).toBe(0);
  });
});
