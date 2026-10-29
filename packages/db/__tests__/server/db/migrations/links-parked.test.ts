// @vitest-environment node
/**
 * Links from before 0.25, keyed by a folded name only, are parked for the boot upgrade rather than
 * deleted, when 0075 keys every link by its Ingredient; 0083 leaves the parking as it is.
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

describe("links from before 0.25 at migration 0075", () => {
  const testDbName = generateTestDbName("test_links_parked");
  let pool: pg.Pool;

  const ids = {
    user: randomUUID(),
    store: randomUUID(),
    aisle: randomUUID(),
    ingredient: randomUUID(),
    oldAisleLink: randomUUID(),
    oldPreference: randomUUID(),
    oldProductLink: randomUUID(),
    blankProductLink: randomUUID(),
    keyedAisleLink: randomUUID(),
  };

  async function applyMigration(tag: string): Promise<void> {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() !== "") await pool.query(statement);
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: await createTestDatabase(testDbName) });

    const { entries } = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const tags = entries.map((entry) => entry.tag);
    const at = tags.indexOf("0075_links_keyed_by_ingredient");

    for (const tag of tags.slice(0, at)) await applyMigration(tag);

    await pool.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, 'Cook', 'cook@example.com')`,
      [ids.user]
    );
    await pool.query(`INSERT INTO stores (id, user_id, name) VALUES ($1, $2, 'Shop')`, [
      ids.store,
      ids.user,
    ]);
    await pool.query(`INSERT INTO aisles (id, store_id, name) VALUES ($1, $2, 'Dairy')`, [
      ids.aisle,
      ids.store,
    ]);
    await pool.query(`INSERT INTO ingredients (id, name) VALUES ($1, 'milk')`, [ids.ingredient]);
    await pool.query(
      `INSERT INTO aisle_links (id, store_id, aisle_id, normalized_name) VALUES ($1, $2, $3, 'butter')`,
      [ids.oldAisleLink, ids.store, ids.aisle]
    );
    await pool.query(
      `INSERT INTO aisle_links (id, store_id, aisle_id, ingredient_id) VALUES ($1, $2, $3, $4)`,
      [ids.keyedAisleLink, ids.store, ids.aisle, ids.ingredient]
    );
    await pool.query(
      `INSERT INTO ingredient_store_preferences (id, user_id, store_id, normalized_name) VALUES ($1, $2, $3, 'eggs')`,
      [ids.oldPreference, ids.user, ids.store]
    );
    await pool.query(
      `INSERT INTO store_product_links (id, store_id, normalized_name) VALUES ($1, $2, 'flour'), ($3, $2, '')`,
      [ids.oldProductLink, ids.store, ids.blankProductLink]
    );

    for (const tag of tags.slice(at)) await applyMigration(tag);
    // An install that ran the rc's 0075, which had no parking, meets 0083 with the table in place.
    await applyMigration("0083_parked_name_keyed_links");
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("parks every link keyed by a name, as it stood", async () => {
    const parked = await pool.query<{ id: string; kind: string; name: string; store: string }>(
      `SELECT id, kind, link->>'normalized_name' AS name, link->>'store_id' AS store FROM parked_name_keyed_links ORDER BY name`
    );

    expect(parked.rows).toEqual([
      { id: ids.oldAisleLink, kind: "aisle", name: "butter", store: ids.store },
      { id: ids.oldPreference, kind: "preference", name: "eggs", store: ids.store },
      { id: ids.oldProductLink, kind: "product", name: "flour", store: ids.store },
    ]);
  });

  it("keeps the links already keyed by an Ingredient, and only those", async () => {
    const links = await pool.query(`SELECT id FROM aisle_links`);
    const preferences = await pool.query(`SELECT id FROM ingredient_store_preferences`);
    const products = await pool.query(`SELECT id FROM store_product_links`);

    expect(links.rows).toEqual([{ id: ids.keyedAisleLink }]);
    expect(preferences.rowCount).toBe(0);
    expect(products.rowCount).toBe(0);
  });
});
