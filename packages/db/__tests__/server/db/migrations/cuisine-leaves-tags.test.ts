// @vitest-environment node
/**
 * Cuisine leaves the predefined Tag vocabulary.
 *
 * Tested through the migration runner the server actually uses, against a
 * database seeded with recipes as they existed before it: a one-time data
 * migration is only correct if it is correct against real prior state, and
 * only safe if running it again changes nothing.
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
const CUISINE_MIGRATION = resolve(MIGRATIONS_FOLDER, "0037_cuisine_leaves_tags.sql");

/** Migrations up to but not including the one under test. */
const PRIOR_JOURNAL = {
  version: "7",
  dialect: "postgresql",
  entries: [] as {
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }[],
};

describe("cuisine tags migrating onto the Cuisine vocabulary", () => {
  const testDbName = generateTestDbName("test_cuisine_leaves_tags");
  let pool: pg.Pool;
  let userId: string;

  /** Ids of the fixture recipes, by the role they play. */
  const recipes = {
    italian: randomUUID(),
    fusion: randomUUID(),
    folksonomy: randomUUID(),
    untagged: randomUUID(),
  };

  async function applyCuisineMigration(): Promise<void> {
    const sql = await readFile(CUISINE_MIGRATION, "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() === "") continue;

      await pool.query(statement);
    }
  }

  async function tagNames(recipeId: string): Promise<string[]> {
    const result = await pool.query<{ name: string }>(
      `SELECT t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id
       WHERE rt.recipe_id = $1 ORDER BY rt."order"`,
      [recipeId]
    );

    return result.rows.map((row) => row.name);
  }

  async function cuisineNames(recipeId: string): Promise<string[]> {
    const result = await pool.query<{ name: string }>(
      `SELECT c.name FROM recipe_cuisines rc JOIN cuisines c ON c.id = rc.cuisine_id
       WHERE rc.recipe_id = $1 ORDER BY rc."order"`,
      [recipeId]
    );

    return result.rows.map((row) => row.name);
  }

  async function allTagNames(): Promise<string[]> {
    const result = await pool.query<{ name: string }>("SELECT name FROM tags ORDER BY name");

    return result.rows.map((row) => row.name);
  }

  async function tagRecipe(recipeId: string, names: string[]): Promise<void> {
    for (const [order, name] of names.entries()) {
      const tag = await pool.query<{ id: string }>(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT DO NOTHING RETURNING id`,
        [name]
      );
      const tagId =
        tag.rows[0]?.id ??
        (
          await pool.query<{ id: string }>("SELECT id FROM tags WHERE lower(name) = lower($1)", [
            name,
          ])
        ).rows[0]!.id;

      await pool.query(`INSERT INTO recipe_tags (recipe_id, tag_id, "order") VALUES ($1, $2, $3)`, [
        recipeId,
        tagId,
        order,
      ]);
    }
  }

  beforeAll(async () => {
    const testDbUrl = await createTestDatabase(testDbName);

    pool = new pg.Pool({ connectionString: testDbUrl });

    // Apply every migration up to and including the one that seeds the
    // vocabulary, but stop before the one under test, so the fixtures below are
    // the state a real deployment upgrades from.
    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    );

    PRIOR_JOURNAL.entries = journal.entries.filter(
      (entry: { tag: string }) => entry.tag !== "0037_cuisine_leaves_tags"
    );

    for (const entry of PRIOR_JOURNAL.entries) {
      const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${entry.tag}.sql`), "utf8");

      for (const statement of sql.split("--> statement-breakpoint")) {
        if (statement.trim() === "") continue;

        await pool.query(statement);
      }
    }

    userId = `user-${randomUUID()}`;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, 'Test', $2, false, now(), now())`,
      [userId, `${userId}@example.com`]
    );

    for (const [role, id] of Object.entries(recipes)) {
      await pool.query("INSERT INTO recipes (id, user_id, name) VALUES ($1, $2, $3)", [
        id,
        userId,
        `Recipe ${role}`,
      ]);
    }

    await tagRecipe(recipes.italian, ["italian", "pasta", "easy"]);
    await tagRecipe(recipes.fusion, ["japanese", "mexican", "quick meal"]);
    // Free-form cuisine-like Tags outside the seeded vocabulary.
    await tagRecipe(recipes.folksonomy, ["sicilian", "tex-mex", "levantine"]);

    await applyCuisineMigration();
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("attaches the corresponding Cuisine to a recipe holding a matched Tag", async () => {
    expect(await cuisineNames(recipes.italian)).toEqual(["Italian"]);
  });

  it("attaches every matched Cuisine to a recipe holding several", async () => {
    expect(await cuisineNames(recipes.fusion)).toEqual(["Japanese", "Mexican"]);
  });

  it("removes the matched Tags from the recipes that carried them", async () => {
    expect(await tagNames(recipes.italian)).toEqual(["pasta", "easy"]);
    expect(await tagNames(recipes.fusion)).toEqual(["quick meal"]);
  });

  it("removes the now-orphaned tag rows, not just the associations", async () => {
    // Load-bearing: under `predefined_db` the auto-tagging prompt injects every
    // existing tag name back in, so a surviving orphan would keep cuisine in
    // circulation after the migration meant to end it.
    const names = await allTagNames();

    expect(names).not.toContain("italian");
    expect(names).not.toContain("japanese");
    expect(names).not.toContain("mexican");
  });

  it("leaves unmatched Tags untouched, including free-form cuisine-like ones", async () => {
    expect(await tagNames(recipes.folksonomy)).toEqual(["sicilian", "tex-mex", "levantine"]);
    expect(await cuisineNames(recipes.folksonomy)).toEqual([]);
    expect(await allTagNames()).toEqual(
      expect.arrayContaining(["sicilian", "tex-mex", "levantine", "pasta", "easy", "quick meal"])
    );
  });

  it("leaves a recipe with no cuisine Tags alone", async () => {
    expect(await tagNames(recipes.untagged)).toEqual([]);
    expect(await cuisineNames(recipes.untagged)).toEqual([]);
  });

  it("records what it removed, per recipe", async () => {
    const removed = await pool.query<{ recipe_id: string; tag_name: string; cuisine_id: string }>(
      "SELECT recipe_id, tag_name, cuisine_id FROM cuisine_tag_migrations ORDER BY tag_name"
    );

    expect(removed.rows).toEqual([
      expect.objectContaining({ recipe_id: recipes.italian, tag_name: "italian" }),
      expect.objectContaining({ recipe_id: recipes.fusion, tag_name: "japanese" }),
      expect.objectContaining({ recipe_id: recipes.fusion, tag_name: "mexican" }),
    ]);
    expect(removed.rows.every((row) => row.cuisine_id !== null)).toBe(true);
  });

  it("is a no-op when it runs again", async () => {
    const before = {
      tags: await allTagNames(),
      italian: await cuisineNames(recipes.italian),
      fusion: await cuisineNames(recipes.fusion),
      recorded: (await pool.query("SELECT count(*)::int AS n FROM cuisine_tag_migrations")).rows[0],
    };

    await applyCuisineMigration();

    expect(await allTagNames()).toEqual(before.tags);
    expect(await cuisineNames(recipes.italian)).toEqual(before.italian);
    expect(await cuisineNames(recipes.fusion)).toEqual(before.fusion);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM cuisine_tag_migrations")).rows[0]
    ).toEqual(before.recorded);
  });

  it("records the removal in a shape an operator can query", async () => {
    const columns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'cuisine_tag_migrations'"
    );

    expect(columns.rows.map((row) => row.column_name).sort()).toEqual([
      "cuisine_id",
      "id",
      "migrated_at",
      "recipe_id",
      "tag_name",
    ]);
  });
});
