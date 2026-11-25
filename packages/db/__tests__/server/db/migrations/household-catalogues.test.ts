// @vitest-environment node
/**
 * Migration 0093 on a catalogue of an earlier release: own foods go to their minter's household
 * (the heir's when the minter is gone), a food two households use is split (the minter's keeps the
 * id; the other's copy carries its spellings, the icon, a parent of its own and the AI Changes),
 * and every row follows its household's copy. A second run changes nothing.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resetDbConnection } from "@norish/db/drizzle";

import {
  createTestDatabase,
  generateTestDbName,
  teardownTestDatabase,
} from "../../../helpers/db-setup";

const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../src/migrations"
);
const MIGRATION_TAG = "0093_household_catalogues";

describe("each household gets its own catalogue", () => {
  const testDbName = generateTestDbName("test_household_catalogues");
  const originalUrl = SERVER_CONFIG.DATABASE_URL;
  // One connection: the migration's helper functions live in its session.
  let pool: pg.Pool;
  const q = (text: string, values: unknown[] = []) => pool.query(text, values);
  const [ann, bob, gone] = ["user-ann", "user-bob", "user-gone"];
  const food = {
    onion: randomUUID(),
    chicken: randomUUID(),
    shallot: randomUUID(),
    kip: randomUUID(),
    kipfilet: randomUUID(),
    zout: randomUUID(),
    annOnly: randomUUID(),
  };
  const spelling = {
    onion: randomUUID(),
    uitje: randomUUID(),
    chicken: randomUUID(),
    shallot: randomUUID(),
    kip: randomUUID(),
    kipfilet: randomUUID(),
    kipfilets: randomUUID(),
    filet: randomUUID(),
    zout: randomUUID(),
    annOnly: randomUUID(),
  };
  const recipe = { ann: randomUUID(), bob: randomUUID() };
  const line = { ann: randomUUID(), annOnion: randomUUID(), bob: randomUUID() };
  const store = { ann: randomUUID(), bob: randomUUID() };
  const aisle = { ann: randomUUID(), bob: randomUUID() };
  const change = { parent: randomUUID(), merge: randomUUID(), name: randomUUID() };
  let households: { ann: string; bob: string };

  async function apply(tag: string) {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() !== "") await pool.query(statement);
    }
  }

  const rows = async (text: string) => (await q(text)).rows;
  const snapshot = async () => ({
    ingredients: await rows(
      `SELECT id, household_id, name, owner_id, parent_id, icon, off_id FROM ingredients ORDER BY household_id NULLS FIRST, name`
    ),
    aliases: await rows(
      `SELECT id, household_id, text, ingredient_id, owner_id, seeded FROM ingredient_aliases ORDER BY household_id NULLS FIRST, text`
    ),
    lineFoods: await rows(
      `SELECT recipe_ingredient_id, ingredient_alias_id FROM recipe_ingredient_foods ORDER BY recipe_ingredient_id`
    ),
    groceries: await rows(
      `SELECT household_id, ingredient_id, ingredient_alias_id FROM groceries ORDER BY household_id, name`
    ),
    pantry: await rows(
      `SELECT household_id, ingredient_id, ingredient_alias_id FROM pantry_ingredients ORDER BY household_id`
    ),
    aisleLinks: await rows(`SELECT store_id, ingredient_id FROM aisle_links ORDER BY store_id`),
    productLinks: await rows(
      `SELECT store_id, ingredient_id FROM store_product_links ORDER BY store_id`
    ),
    preferences: await rows(
      `SELECT household_id, ingredient_id FROM ingredient_store_preferences ORDER BY household_id`
    ),
    corrections: await rows(
      `SELECT household_id, ingredient_id FROM ingredient_nutrition_corrections ORDER BY household_id`
    ),
    estimates: await rows(
      `SELECT ingredient_id, kcal FROM ingredient_nutrition_estimates ORDER BY ingredient_id`
    ),
    changes: await rows(
      `SELECT kind, household_id, ingredient_id, target_id, undo FROM ingredient_ai_changes ORDER BY household_id, kind`
    ),
    junk: await rows(
      `SELECT household_id, fold, reason FROM ingredient_junk_pile ORDER BY household_id NULLS FIRST, fold`
    ),
  });

  beforeAll(async () => {
    const url = await createTestDatabase(testDbName);

    pool = new pg.Pool({ connectionString: url, max: 1 });
    SERVER_CONFIG.DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    await resetDbConnection();

    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const index = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

    expect(index).toBeGreaterThan(0);
    for (const entry of journal.entries.slice(0, index)) await apply(entry.tag);

    for (const [id, owner] of [
      [ann, true],
      [bob, false],
      [gone, false],
    ] as const) {
      await q(
        `INSERT INTO "user" (id, name, email, "createdAt", "isServerOwner") VALUES ($1, 'enc', $1, now(), $2)`,
        [id, owner]
      );
    }
    const householdOf = async (userId: string) =>
      (await q("SELECT household_id FROM household_users WHERE user_id = $1", [userId])).rows[0]
        .household_id as string;

    households = { ann: await householdOf(ann), bob: await householdOf(bob) };

    await q(
      `INSERT INTO ingredients (id, name, off_id, owner_id, parent_id, icon) VALUES
       ($1, 'Onion', 'en:onion', NULL, NULL, NULL), ($2, 'Chicken', 'en:chicken', NULL, NULL, NULL),
       ($4, 'kip', NULL, $8, $2, NULL), ($3, 'Shallot', 'en:shallot', NULL, $4, NULL),
       ($5, 'kipfilet', NULL, $8, $4, 'kipfilet.webp'), ($6, 'zout mix', NULL, $9, NULL, NULL),
       ($7, 'ann only', NULL, $8, NULL, NULL)`,
      [
        food.onion,
        food.chicken,
        food.shallot,
        food.kip,
        food.kipfilet,
        food.zout,
        food.annOnly,
        ann,
        gone,
      ]
    );
    await q(
      `INSERT INTO ingredient_aliases (id, text, fold, ingredient_id, owner_id, seeded) VALUES
       ($1, 'onion', 'onion', $11, NULL, true), ($2, 'uitje', 'uitje', $11, $16, false),
       ($3, 'chicken', 'chicken', $12, NULL, true), ($4, 'shallot', 'shallot', $13, NULL, true),
       ($5, 'kip', 'kip', $14, $15, false), ($6, 'kipfilet', 'kipfilet', $17, $15, false),
       ($7, 'kipfilets', 'kipfilets', $17, $16, false), ($8, 'filet', 'filet', $17, $15, false),
       ($9, 'zout mix', 'zout mix', $18, NULL, false), ($10, 'ann only', 'ann only', $19, $15, false)`,
      [
        spelling.onion,
        spelling.uitje,
        spelling.chicken,
        spelling.shallot,
        spelling.kip,
        spelling.kipfilet,
        spelling.kipfilets,
        spelling.filet,
        spelling.zout,
        spelling.annOnly,
        food.onion,
        food.chicken,
        food.shallot,
        food.kip,
        ann,
        bob,
        food.kipfilet,
        food.zout,
        food.annOnly,
      ]
    );
    // The minter's account went: the food's owner is null now.
    await q(`DELETE FROM "user" WHERE id = $1`, [gone]);

    await q(`INSERT INTO recipes (id, user_id, name) VALUES ($1, $3, 'Ann'), ($2, $4, 'Bob')`, [
      recipe.ann,
      recipe.bob,
      ann,
      bob,
    ]);
    await q(
      `INSERT INTO recipe_ingredients (id, recipe_id, name) VALUES
       ($1, $4, 'kipfilet'), ($2, $4, 'uitje'), ($3, $5, 'kipfilets')`,
      [line.ann, line.annOnion, line.bob, recipe.ann, recipe.bob]
    );
    await q(
      `INSERT INTO recipe_ingredient_foods (recipe_ingredient_id, position, ingredient_alias_id) VALUES
       ($1, 0, $4), ($2, 0, $5), ($3, 0, $6)`,
      [line.ann, line.annOnion, line.bob, spelling.kipfilet, spelling.uitje, spelling.kipfilets]
    );
    await q(
      `INSERT INTO groceries (household_id, name, ingredient_id, ingredient_alias_id) VALUES
       ($1, 'kipfilets', $3, $4), ($1, 'zout mix', $5, $6), ($2, 'ann only', $7, $8)`,
      [
        households.bob,
        households.ann,
        food.kipfilet,
        spelling.kipfilets,
        food.zout,
        spelling.zout,
        food.annOnly,
        spelling.annOnly,
      ]
    );
    await q(
      `INSERT INTO pantry_ingredients (household_id, ingredient_id, ingredient_alias_id) VALUES ($1, $2, $3)`,
      [households.bob, food.kipfilet, spelling.kipfilets]
    );
    await q(
      `INSERT INTO stores (id, household_id, name) VALUES ($1, $3, 'Ann shop'), ($2, $4, 'Bob shop')`,
      [store.ann, store.bob, households.ann, households.bob]
    );
    await q(`INSERT INTO aisles (id, store_id, name) VALUES ($1, $3, 'Meat'), ($2, $4, 'Meat')`, [
      aisle.ann,
      aisle.bob,
      store.ann,
      store.bob,
    ]);
    await q(
      `INSERT INTO aisle_links (store_id, ingredient_id, aisle_id) VALUES ($1, $3, $4), ($2, $3, $5)`,
      [store.ann, store.bob, food.kipfilet, aisle.ann, aisle.bob]
    );
    await q(`INSERT INTO store_product_links (store_id, ingredient_id) VALUES ($1, $3), ($2, $3)`, [
      store.ann,
      store.bob,
      food.kipfilet,
    ]);
    await q(
      `INSERT INTO ingredient_store_preferences (household_id, ingredient_id, store_id) VALUES ($1, $2, $3)`,
      [households.bob, food.kipfilet, store.bob]
    );
    await q(
      `INSERT INTO ingredient_nutrition_corrections (household_id, ingredient_id, kcal) VALUES ($1, $2, 120)`,
      [households.bob, food.kipfilet]
    );
    await q(`INSERT INTO ingredient_nutrition_estimates (ingredient_id, kcal) VALUES ($1, 110)`, [
      food.kipfilet,
    ]);
    await q(
      `INSERT INTO ingredient_ai_changes (id, kind, ingredient_id, target_id, sure, undo) VALUES
       ($1, 'parent', $4, $5, true, $6), ($2, 'merge', $4, NULL, false, $7),
       ($3, 'plain-name', $4, NULL, true, $8)`,
      [
        change.parent,
        change.merge,
        change.name,
        food.kipfilet,
        food.kip,
        JSON.stringify({ kind: "parent", formerParentId: food.kip }),
        JSON.stringify({
          kind: "merge",
          name: "kipfilet stukjes",
          ownerId: ann,
          aliasIds: [spelling.kipfilets, spelling.filet],
          parentId: food.kip,
        }),
        JSON.stringify({ kind: "plain-name", formerName: "Kipfilet", name: "kipfilet" }),
      ]
    );
    await q(
      `INSERT INTO ingredient_junk_pile (fold, reason) VALUES ('stuk', 'seed'), ('blabla', 'person')`
    );

    await apply(MIGRATION_TAG);
  });

  afterAll(async () => {
    await pool.end();
    SERVER_CONFIG.DATABASE_URL = originalUrl;
    process.env.DATABASE_URL = originalUrl;
    await resetDbConnection();
    await teardownTestDatabase(testDbName);
  });

  /** The ids rows hold after the split, by household and original. */
  async function copyOf(original: string, householdId: string): Promise<string> {
    const [name] = (await q(`SELECT name FROM ingredients WHERE id = $1`, [original])).rows;
    const [copy] = (
      await q(`SELECT id FROM ingredients WHERE household_id = $1 AND name = $2`, [
        householdId,
        name.name,
      ])
    ).rows;

    return copy.id as string;
  }

  async function spellingIn(householdId: string, text: string): Promise<string> {
    const [row] = (
      await q(`SELECT id FROM ingredient_aliases WHERE household_id = $1 AND text = $2`, [
        householdId,
        text,
      ])
    ).rows;

    return row.id as string;
  }

  it("gives each own food its minter's household, the heir's when the minter is gone, and splits a shared one", async () => {
    const kipfiletB = await copyOf(food.kipfilet, households.bob);
    const kipB = await copyOf(food.kip, households.bob);
    const zoutB = await copyOf(food.zout, households.bob);

    expect((await snapshot()).ingredients).toEqual([
      {
        id: food.chicken,
        household_id: null,
        name: "Chicken",
        owner_id: null,
        parent_id: null,
        icon: null,
        off_id: "en:chicken",
      },
      {
        id: food.onion,
        household_id: null,
        name: "Onion",
        owner_id: null,
        parent_id: null,
        icon: null,
        off_id: "en:onion",
      },
      // A seeded food keeps no own parent: it is every household's.
      {
        id: food.shallot,
        household_id: null,
        name: "Shallot",
        owner_id: null,
        parent_id: null,
        icon: null,
        off_id: "en:shallot",
      },
      ...[
        {
          id: food.annOnly,
          household_id: households.ann,
          name: "ann only",
          owner_id: ann,
          parent_id: null,
          icon: null,
          off_id: null,
        },
        {
          id: food.kip,
          household_id: households.ann,
          name: "kip",
          owner_id: ann,
          parent_id: food.chicken,
          icon: null,
          off_id: null,
        },
        {
          id: food.kipfilet,
          household_id: households.ann,
          name: "kipfilet",
          owner_id: ann,
          parent_id: food.kip,
          icon: "kipfilet.webp",
          off_id: null,
        },
        {
          id: food.zout,
          household_id: households.ann,
          name: "zout mix",
          owner_id: null,
          parent_id: null,
          icon: null,
          off_id: null,
        },
        {
          id: kipB,
          household_id: households.bob,
          name: "kip",
          owner_id: null,
          parent_id: food.chicken,
          icon: null,
          off_id: null,
        },
        {
          id: kipfiletB,
          household_id: households.bob,
          name: "kipfilet",
          owner_id: null,
          parent_id: kipB,
          icon: "kipfilet.webp",
          off_id: null,
        },
        {
          id: zoutB,
          household_id: households.bob,
          name: "zout mix",
          owner_id: null,
          parent_id: null,
          icon: null,
          off_id: null,
        },
      ].sort((a, b) =>
        a.household_id === b.household_id
          ? a.name.localeCompare(b.name)
          : a.household_id.localeCompare(b.household_id)
      ),
    ]);
  });

  it("gives a copy the spellings its household uses and a person's spelling on a seeded food to each household using it", async () => {
    const aliases = (await snapshot()).aliases;
    const byHousehold = (householdId: string | null) =>
      aliases
        .filter((row) => row.household_id === householdId)
        .map((row) => [row.text, row.owner_id, row.seeded]);

    expect(byHousehold(null)).toEqual([
      ["chicken", null, true],
      ["onion", null, true],
      ["shallot", null, true],
    ]);
    expect(byHousehold(households.ann)).toEqual([
      ["ann only", ann, false],
      ["filet", ann, false],
      ["kip", ann, false],
      ["kipfilet", ann, false],
      ["kipfilets", bob, false],
      ["uitje", null, false],
      ["zout mix", null, false],
    ]);
    // Bob's: what his rows use (kipfilets, zout mix), the oldest of a copy he uses no spelling of
    // (kip), and his own spelling on the seeded onion.
    expect(byHousehold(households.bob)).toEqual([
      ["kip", null, false],
      ["kipfilets", bob, false],
      ["uitje", bob, false],
      ["zout mix", null, false],
    ]);
    expect(aliases.find((row) => row.id === spelling.uitje)?.household_id).toBe(households.bob);
    expect(aliases.filter((row) => row.text === "uitje").map((row) => row.ingredient_id)).toEqual([
      food.onion,
      food.onion,
    ]);
  });

  it("points every row at its household's food and spelling, Store links by their Store's household", async () => {
    const kipfiletB = await copyOf(food.kipfilet, households.bob);
    const zoutB = await copyOf(food.zout, households.bob);
    const state = await snapshot();

    expect(state.lineFoods).toEqual(
      [
        { recipe_ingredient_id: line.ann, ingredient_alias_id: spelling.kipfilet },
        {
          recipe_ingredient_id: line.annOnion,
          ingredient_alias_id: await spellingIn(households.ann, "uitje"),
        },
        {
          recipe_ingredient_id: line.bob,
          ingredient_alias_id: await spellingIn(households.bob, "kipfilets"),
        },
      ].sort((a, b) => a.recipe_ingredient_id.localeCompare(b.recipe_ingredient_id))
    );
    expect(state.groceries).toEqual(
      [
        {
          household_id: households.ann,
          ingredient_id: food.annOnly,
          ingredient_alias_id: spelling.annOnly,
        },
        {
          household_id: households.bob,
          ingredient_id: kipfiletB,
          ingredient_alias_id: await spellingIn(households.bob, "kipfilets"),
        },
        {
          household_id: households.bob,
          ingredient_id: zoutB,
          ingredient_alias_id: await spellingIn(households.bob, "zout mix"),
        },
      ].sort((a, b) => a.household_id.localeCompare(b.household_id))
    );
    expect(state.pantry).toEqual([
      {
        household_id: households.bob,
        ingredient_id: kipfiletB,
        ingredient_alias_id: await spellingIn(households.bob, "kipfilets"),
      },
    ]);
    const byStore = (row: { store_id: string; ingredient_id: string }) => [
      row.store_id,
      row.ingredient_id,
    ];

    expect(state.aisleLinks.map(byStore).sort()).toEqual(
      [
        [store.ann, food.kipfilet],
        [store.bob, kipfiletB],
      ].sort()
    );
    expect(state.productLinks.map(byStore).sort()).toEqual(
      [
        [store.ann, food.kipfilet],
        [store.bob, kipfiletB],
      ].sort()
    );
    expect(state.preferences).toEqual([{ household_id: households.bob, ingredient_id: kipfiletB }]);
    expect(state.corrections).toEqual([{ household_id: households.bob, ingredient_id: kipfiletB }]);
    expect(state.estimates.map((row) => row.ingredient_id).sort()).toEqual(
      [food.kipfilet, kipfiletB].sort()
    );
  });

  it("copies the AI Changes onto the copy, on its own household's spellings and parents", async () => {
    const kipfiletB = await copyOf(food.kipfilet, households.bob);
    const kipB = await copyOf(food.kip, households.bob);
    const changes = (await snapshot()).changes;

    expect(changes.filter((row) => row.household_id === households.ann)).toEqual([
      expect.objectContaining({ kind: "merge", ingredient_id: food.kipfilet, target_id: null }),
      expect.objectContaining({
        kind: "parent",
        ingredient_id: food.kipfilet,
        target_id: food.kip,
      }),
      expect.objectContaining({ kind: "plain-name", ingredient_id: food.kipfilet }),
    ]);
    expect(changes.filter((row) => row.household_id === households.bob)).toEqual([
      {
        kind: "merge",
        household_id: households.bob,
        ingredient_id: kipfiletB,
        target_id: null,
        undo: {
          kind: "merge",
          name: "kipfilet stukjes",
          ownerId: null,
          aliasIds: [await spellingIn(households.bob, "kipfilets")],
          parentId: kipB,
        },
      },
      {
        kind: "parent",
        household_id: households.bob,
        ingredient_id: kipfiletB,
        target_id: kipB,
        undo: { kind: "parent", formerParentId: kipB },
      },
      {
        kind: "plain-name",
        household_id: households.bob,
        ingredient_id: kipfiletB,
        target_id: null,
        undo: { kind: "plain-name", formerName: "Kipfilet", name: "kipfilet" },
      },
    ]);
  });

  it("keeps the seed's junk the seed's and holds every other mark for each household", async () => {
    expect((await snapshot()).junk).toEqual([
      { household_id: null, fold: "stuk", reason: "seed" },
      ...[households.ann, households.bob]
        .sort()
        .map((household_id) => ({ household_id, fold: "blabla", reason: "person" })),
    ]);
  });

  it("changes nothing when run again", async () => {
    const before = await snapshot();

    await apply(MIGRATION_TAG);

    expect(await snapshot()).toEqual(before);
  });
});
