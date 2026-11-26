// @vitest-environment node
/**
 * Migration 0093 on a catalogue of an earlier release: own foods go to their minter's household
 * (the heir's when the minter is gone), a food two households use is split (the minter's keeps the
 * id; the other's copy carries its spellings, the icon, a parent of its own and the AI Changes),
 * and every row follows its household's copy. An AI Change names only its household's rows, else
 * has no Undo. A second run changes nothing.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resetDbConnection, withTransaction } from "@norish/db/drizzle";
import {
  listAIChanges,
  lockAIChange,
  undoStaysIn,
} from "@norish/db/repositories/ingredient-ai-changes";

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

/** Run one migration's statements, in order, on the pool's one connection. */
async function applyTo(pool: pg.Pool, tag: string) {
  const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim() !== "") await pool.query(statement);
  }
}

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
    bobOnly: randomUUID(),
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
    bobOnly: randomUUID(),
    removed: randomUUID(),
  };
  const recipe = { ann: randomUUID(), bob: randomUUID() };
  const line = { ann: randomUUID(), annOnion: randomUUID(), bob: randomUUID() };
  const store = { ann: randomUUID(), bob: randomUUID() };
  const aisle = { ann: randomUUID(), bob: randomUUID() };
  const grocery = { bobKipfilet: randomUUID(), bobZout: randomUUID(), annOnly: randomUUID() };
  const recurring = { bob: randomUUID() };
  const change = {
    parent: randomUUID(),
    merge: randomUUID(),
    name: randomUUID(),
    notAFood: randomUUID(),
    moved: randomUUID(),
    removed: randomUUID(),
    foreignParent: randomUUID(),
    foreignSpellings: randomUUID(),
    unknown: randomUUID(),
  };
  let households: { ann: string; bob: string };

  const removedSpelling = (id: string) => ({
    id,
    text: "zoutje",
    fold: "zoutje",
    locale: null,
    ownerId: null,
  });
  const spellingMove = (id: string) =>
    JSON.stringify({
      kind: "spelling",
      spelling: { ...removedSpelling(id), text: "kipfilets", fold: "kipfilets" },
      lines: [],
      groceries: [],
      recurring: [],
    });

  const apply = (tag: string) => applyTo(pool, tag);

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
    recurring: await rows(
      `SELECT id, household_id, ingredient_id, ingredient_alias_id FROM recurring_groceries ORDER BY id`
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
      `SELECT id, kind, household_id, ingredient_id, target_id, sure, undo, kept_at, undone_at FROM ingredient_ai_changes ORDER BY household_id, kind, id`
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
       ($7, 'ann only', NULL, $8, NULL, NULL), ($10, 'bob only', NULL, $11, NULL, NULL)`,
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
        food.bobOnly,
        bob,
      ]
    );
    await q(
      `INSERT INTO ingredient_aliases (id, text, fold, ingredient_id, owner_id, seeded) VALUES
       ($1, 'onion', 'onion', $11, NULL, true), ($2, 'uitje', 'uitje', $11, $16, false),
       ($3, 'chicken', 'chicken', $12, NULL, true), ($4, 'shallot', 'shallot', $13, NULL, true),
       ($5, 'kip', 'kip', $14, $15, false), ($6, 'kipfilet', 'kipfilet', $17, $15, false),
       ($7, 'kipfilets', 'kipfilets', $17, $16, false), ($8, 'filet', 'filet', $17, $15, false),
       ($9, 'zout mix', 'zout mix', $18, NULL, false), ($10, 'ann only', 'ann only', $19, $15, false),
       ($20, 'bob only', 'bob only', $21, $16, false)`,
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
        spelling.bobOnly,
        food.bobOnly,
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
      `INSERT INTO groceries (id, household_id, name, ingredient_id, ingredient_alias_id) VALUES
       ($9, $1, 'kipfilets', $3, $4), ($10, $1, 'zout mix', $5, $6), ($11, $2, 'ann only', $7, $8),
       (gen_random_uuid(), $1, 'bob only', $12, $13)`,
      [
        households.bob,
        households.ann,
        food.kipfilet,
        spelling.kipfilets,
        food.zout,
        spelling.zout,
        food.annOnly,
        spelling.annOnly,
        grocery.bobKipfilet,
        grocery.bobZout,
        grocery.annOnly,
        food.bobOnly,
        spelling.bobOnly,
      ]
    );
    await q(
      `INSERT INTO recurring_groceries (id, household_id, name, recurrence_rule, next_planned_for, ingredient_id, ingredient_alias_id)
       VALUES ($1, $2, 'kipfilets', 'week', current_date, $3, $4)`,
      [recurring.bob, households.bob, food.kipfilet, spelling.kipfilets]
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
       ($3, 'plain-name', $4, NULL, true, $8), ($9, 'not-a-food', NULL, NULL, true, $10),
       ($11, 'spelling', $13, $4, true, $14), ($12, 'spelling', $15, NULL, true, $16),
       ($17, 'parent', $13, NULL, false, $18), ($19, 'not-a-food', NULL, NULL, true, $20),
       ($21, 'refile', $13, NULL, true, '{"kind": "refile"}')`,
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
        change.notAFood,
        // Ann's deleted food named Bob's line too: Ann's Undo would point Bob's line at her food.
        JSON.stringify({
          kind: "not-a-food",
          food: {
            ingredientId: randomUUID(),
            name: "stukje",
            ownerId: ann,
            parentId: food.kip,
            aliases: [],
            lineFoods: [
              { lineId: line.ann, position: 1, aliasId: spelling.removed },
              { lineId: line.bob, position: 1, aliasId: spelling.removed },
            ],
            groceries: [{ id: grocery.annOnly, aliasId: null }],
            recurring: [],
          },
        }),
        change.moved,
        change.removed,
        food.annOnly,
        spellingMove(spelling.kipfilets),
        food.zout,
        // Ann added the spelling: Bob's copy of the change names no adder.
        JSON.stringify({
          kind: "spelling",
          spelling: { ...removedSpelling(spelling.removed), ownerId: ann },
          lines: [{ id: line.bob, aliasIds: [spelling.kipfilets], joined: null }],
          groceries: [grocery.bobZout],
          recurring: [],
          left: { [grocery.bobZout]: [spelling.zout] },
        }),
        change.foreignParent,
        // Ann's food came from under Bob's own food, which Ann has no copy of.
        JSON.stringify({ kind: "parent", formerParentId: food.bobOnly }),
        change.foreignSpellings,
        // Only the spellings inside name Bob's: his own food's, which Ann has no copy of.
        JSON.stringify({
          kind: "not-a-food",
          food: {
            ingredientId: randomUUID(),
            name: "bob only bits",
            ownerId: ann,
            parentId: null,
            aliases: [{ ...removedSpelling(spelling.bobOnly), text: "bob only" }],
            lineFoods: [{ lineId: line.ann, position: 2, aliasId: spelling.bobOnly }],
            groceries: [{ id: grocery.annOnly, aliasId: spelling.bobOnly }],
            recurring: [],
          },
        }),
        change.unknown,
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
          id: food.bobOnly,
          household_id: households.bob,
          name: "bob only",
          owner_id: bob,
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
      ["bob only", bob, false],
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
          ingredient_id: food.bobOnly,
          ingredient_alias_id: spelling.bobOnly,
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
    expect(state.recurring).toEqual([
      {
        id: recurring.bob,
        household_id: households.bob,
        ingredient_id: kipfiletB,
        ingredient_alias_id: await spellingIn(households.bob, "kipfilets"),
      },
    ]);
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

  it("gives every AI Change its household's foods, spellings and rows, else no Undo and no foreign name", async () => {
    const kipfiletB = await copyOf(food.kipfilet, households.bob);
    const kipB = await copyOf(food.kip, households.bob);
    const zoutB = await copyOf(food.zout, households.bob);
    const changes = (await snapshot()).changes;
    const row = (fields: Record<string, unknown>) => ({
      target_id: null,
      sure: true,
      kept_at: null,
      undone_at: null,
      ...fields,
    });
    const copyId = (kind: string, ingredientId: string) =>
      changes.find((change) => change.kind === kind && change.ingredient_id === ingredientId)?.id;
    const merge = {
      kind: "merge",
      name: "kipfilet stukjes",
      ownerId: ann,
      aliasIds: [spelling.kipfilets, spelling.filet],
      parentId: food.kip,
    };
    expect(changes.filter((change) => change.household_id === households.ann)).toEqual([
      row({
        id: change.merge,
        kind: "merge",
        household_id: households.ann,
        ingredient_id: food.kipfilet,
        sure: false,
        undo: merge,
      }),
      ...[
        // The deleted food named Bob's line: Ann keeps her own rows and no Undo.
        row({
          id: change.notAFood,
          kind: "not-a-food",
          household_id: households.ann,
          ingredient_id: null,
          undo: {
            kind: "not-a-food",
            food: expect.objectContaining({
              parentId: food.kip,
              lineFoods: [{ lineId: line.ann, position: 1, aliasId: spelling.removed }],
              groceries: [{ id: grocery.annOnly, aliasId: null }],
            }),
            stranded: true,
          },
        }),
        // Its spellings inside were Bob's: every object naming one is left out.
        row({
          id: change.foreignSpellings,
          kind: "not-a-food",
          household_id: households.ann,
          ingredient_id: null,
          undo: {
            kind: "not-a-food",
            food: expect.objectContaining({
              aliases: [],
              lineFoods: [],
              groceries: [],
              recurring: [],
            }),
            stranded: true,
          },
        }),
      ].sort((a, b) => (a.id as string).localeCompare(b.id as string)),
      ...[
        row({
          id: change.parent,
          kind: "parent",
          household_id: households.ann,
          ingredient_id: food.kipfilet,
          target_id: food.kip,
          undo: { kind: "parent", formerParentId: food.kip },
        }),
        // Bob's own food is no parent Ann could go back to.
        row({
          id: change.foreignParent,
          kind: "parent",
          household_id: households.ann,
          ingredient_id: food.annOnly,
          sure: false,
          undo: { kind: "parent", formerParentId: null, stranded: true },
        }),
      ].sort((a, b) => (a.id as string).localeCompare(b.id as string)),
      row({
        id: change.name,
        kind: "plain-name",
        household_id: households.ann,
        ingredient_id: food.kipfilet,
        undo: { kind: "plain-name", formerName: "Kipfilet", name: "kipfilet" },
      }),
      // A kind the migration does not know has no Undo.
      row({
        id: change.unknown,
        kind: "refile",
        household_id: households.ann,
        ingredient_id: food.annOnly,
        undo: { kind: "refile", stranded: true },
      }),
      ...[
        row({
          id: change.moved,
          kind: "spelling",
          household_id: households.ann,
          ingredient_id: food.annOnly,
          target_id: food.kipfilet,
          undo: JSON.parse(spellingMove(spelling.kipfilets)),
        }),
        // The removal's rows were Bob's: Ann keeps none of them and no Undo.
        row({
          id: change.removed,
          kind: "spelling",
          household_id: households.ann,
          ingredient_id: food.zout,
          undo: {
            kind: "spelling",
            spelling: { ...removedSpelling(spelling.removed), ownerId: ann },
            lines: [],
            groceries: [],
            recurring: [],
            left: {},
            stranded: true,
          },
        }),
      ].sort((a, b) => (a.id as string).localeCompare(b.id as string)),
    ]);
    expect(changes.filter((change) => change.household_id === households.bob)).toEqual([
      // Bob's copy has none of Ann's "filet", so it keeps no Undo.
      row({
        id: copyId("merge", kipfiletB),
        kind: "merge",
        household_id: households.bob,
        ingredient_id: kipfiletB,
        sure: false,
        undo: {
          ...merge,
          ownerId: null,
          aliasIds: [await spellingIn(households.bob, "kipfilets")],
          parentId: kipB,
          stranded: true,
        },
      }),
      row({
        id: copyId("parent", kipfiletB),
        kind: "parent",
        household_id: households.bob,
        ingredient_id: kipfiletB,
        target_id: kipB,
        undo: { kind: "parent", formerParentId: kipB },
      }),
      row({
        id: copyId("plain-name", kipfiletB),
        kind: "plain-name",
        household_id: households.bob,
        ingredient_id: kipfiletB,
        undo: { kind: "plain-name", formerName: "Kipfilet", name: "kipfilet" },
      }),
      row({
        id: copyId("spelling", zoutB),
        kind: "spelling",
        household_id: households.bob,
        ingredient_id: zoutB,
        undo: {
          kind: "spelling",
          spelling: removedSpelling(spelling.removed),
          lines: [
            {
              id: line.bob,
              aliasIds: [await spellingIn(households.bob, "kipfilets")],
              joined: null,
            },
          ],
          groceries: [grocery.bobZout],
          recurring: [],
          left: { [grocery.bobZout]: [await spellingIn(households.bob, "zout mix")] },
        },
      }),
    ]);
  });

  it("lets Undo through only for a change naming its household's rows, and lists no foreign name", async () => {
    const kipfiletB = await copyOf(food.kipfilet, households.bob);
    const zoutB = await copyOf(food.zout, households.bob);
    const readers = {
      ann: { householdId: households.ann, isServerAdmin: false },
      bob: { householdId: households.bob, isServerAdmin: false },
    };
    const undoable = async (reader: keyof typeof readers, id: string) =>
      await withTransaction(async (tx) => {
        const locked = await lockAIChange(tx, readers[reader], id);

        return locked ? await undoStaysIn(tx, readers[reader], locked) : null;
      });
    const bobChange = async (kind: string, ingredientId: string) =>
      (
        await q(
          `SELECT id FROM ingredient_ai_changes WHERE household_id = $1 AND kind = $2 AND ingredient_id = $3`,
          [households.bob, kind, ingredientId]
        )
      ).rows[0].id as string;

    expect({
      merge: await undoable("ann", change.merge),
      parent: await undoable("ann", change.parent),
      name: await undoable("ann", change.name),
      moved: await undoable("ann", change.moved),
      notAFood: await undoable("ann", change.notAFood),
      removed: await undoable("ann", change.removed),
      foreignParent: await undoable("ann", change.foreignParent),
      foreignSpellings: await undoable("ann", change.foreignSpellings),
      unknown: await undoable("ann", change.unknown),
      bobsParent: await undoable("ann", await bobChange("parent", kipfiletB)),
    }).toEqual({
      merge: true,
      parent: true,
      name: true,
      moved: true,
      notAFood: false,
      removed: false,
      foreignParent: false,
      foreignSpellings: false,
      unknown: false,
      bobsParent: null,
    });
    expect({
      merge: await undoable("bob", await bobChange("merge", kipfiletB)),
      parent: await undoable("bob", await bobChange("parent", kipfiletB)),
      removed: await undoable("bob", await bobChange("spelling", zoutB)),
    }).toEqual({ merge: false, parent: true, removed: true });

    const listed = await listAIChanges(readers.ann);

    expect(listed.find((item) => item.id === change.foreignParent)).toMatchObject({
      ingredient: { id: food.annOnly },
      target: null,
      dropped: null,
    });
    expect(
      listed.flatMap((item) => [item.ingredient?.id, item.target?.id, item.dropped?.id])
    ).not.toContain(food.bobOnly);
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
    // Whole rows of every table the migration writes, in an order no rewrite changes.
    const everything = async () =>
      Object.fromEntries(
        await Promise.all(
          [
            "ingredients",
            "ingredient_aliases",
            "recipe_ingredient_foods",
            "groceries",
            "recurring_groceries",
            "pantry_ingredients",
            "aisle_links",
            "store_product_links",
            "ingredient_store_preferences",
            "ingredient_nutrition_corrections",
            "ingredient_nutrition_estimates",
            "ingredient_ai_changes",
            "ingredient_junk_pile",
          ].map(async (table) => [table, await rows(`SELECT * FROM "${table}" t ORDER BY t::text`)])
        )
      );
    const before = await everything();

    await apply(MIGRATION_TAG);

    expect(await everything()).toEqual(before);
  });
});

describe("the heir of a catalogue row whose minter is gone", () => {
  const testDbName = generateTestDbName("test_catalogue_heir");
  let pool: pg.Pool;
  const q = (text: string, values: unknown[] = []) => pool.query(text, values);
  const rows = async (text: string) => (await q(text)).rows;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: await createTestDatabase(testDbName), max: 1 });
    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const index = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

    for (const entry of journal.entries.slice(0, index)) await applyTo(pool, entry.tag);
  });

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  /**
   * In one rolled-back transaction: the accounts, a gone minter's food and spelling, a gone person's
   * spelling on a seeded food and an AI Change naming them; 0093; what it left.
   */
  async function migrateWith(
    accounts: ReadonlyArray<{ id: string; owner?: boolean; admin?: boolean }>
  ) {
    const ids = {
      seeded: randomUUID(),
      orphan: randomUUID(),
      own: randomUUID(),
      onSeed: randomUUID(),
      seedSpelling: randomUUID(),
      change: randomUUID(),
    };

    await q("BEGIN");
    try {
      for (const [index, account] of accounts.entries()) {
        await q(
          `INSERT INTO "user" (id, name, email, "createdAt", "isServerOwner", "isServerAdmin")
           VALUES ($1, 'enc', $1, now() - make_interval(days => $2), $3, $4)`,
          [account.id, accounts.length - index, account.owner ?? false, account.admin ?? false]
        );
      }
      await q(
        `INSERT INTO ingredients (id, name, off_id, owner_id) VALUES ($1, 'Onion', 'en:onion', NULL), ($2, 'orphan', NULL, NULL)`,
        [ids.seeded, ids.orphan]
      );
      await q(
        `INSERT INTO ingredient_aliases (id, text, fold, ingredient_id, owner_id, seeded) VALUES
         ($1, 'onion', 'onion', $4, NULL, true), ($2, 'orphan', 'orphan', $5, NULL, false),
         ($3, 'uitje', 'uitje', $4, NULL, false)`,
        [ids.seedSpelling, ids.own, ids.onSeed, ids.seeded, ids.orphan]
      );
      await q(
        `INSERT INTO ingredient_ai_changes (id, kind, ingredient_id, sure, undo)
         VALUES ($1, 'plain-name', $2, true, '{"kind": "plain-name", "formerName": "Orphan", "name": "orphan"}')`,
        [ids.change, ids.orphan]
      );
      await q(
        `INSERT INTO ingredient_junk_pile (fold, reason) VALUES ('stuk', 'seed'), ('blabla', 'person')`
      );
      await applyTo(pool, MIGRATION_TAG);

      return {
        ids,
        ingredients: await rows(
          `SELECT id, household_id, name, owner_id, parent_id, off_id, added_by_hand FROM ingredients ORDER BY name`
        ),
        aliases: await rows(
          `SELECT id, household_id, text, ingredient_id, owner_id, seeded FROM ingredient_aliases ORDER BY text`
        ),
        changes: await rows(
          `SELECT id, kind, household_id, ingredient_id, target_id, sure, undo FROM ingredient_ai_changes`
        ),
        junk: await rows(
          `SELECT household_id, fold, reason FROM ingredient_junk_pile ORDER BY fold, household_id`
        ),
        households: Object.fromEntries(
          (await rows(`SELECT user_id, household_id FROM household_users`)).map((row) => [
            row.user_id,
            row.household_id,
          ])
        ) as Record<string, string>,
      };
    } finally {
      await q("ROLLBACK");
    }
  }

  function heirsRows(state: Awaited<ReturnType<typeof migrateWith>>, heir: string | null) {
    const { ids } = state;

    return {
      ingredients: [
        {
          id: ids.seeded,
          household_id: null,
          name: "Onion",
          owner_id: null,
          parent_id: null,
          off_id: "en:onion",
          added_by_hand: false,
        },
        ...(heir
          ? [
              {
                id: ids.orphan,
                household_id: heir,
                name: "orphan",
                owner_id: null,
                parent_id: null,
                off_id: null,
                added_by_hand: false,
              },
            ]
          : []),
      ],
      aliases: [
        {
          id: ids.seedSpelling,
          household_id: null,
          text: "onion",
          ingredient_id: ids.seeded,
          owner_id: null,
          seeded: true,
        },
        ...(heir
          ? [
              {
                id: ids.own,
                household_id: heir,
                text: "orphan",
                ingredient_id: ids.orphan,
                owner_id: null,
                seeded: false,
              },
              {
                id: ids.onSeed,
                household_id: heir,
                text: "uitje",
                ingredient_id: ids.seeded,
                owner_id: null,
                seeded: false,
              },
            ]
          : []),
      ],
      changes: heir
        ? [
            {
              id: ids.change,
              kind: "plain-name",
              household_id: heir,
              ingredient_id: ids.orphan,
              target_id: null,
              sure: true,
              undo: { kind: "plain-name", formerName: "Orphan", name: "orphan" },
            },
          ]
        : [],
      // Every household still reads a person's mark as before.
      junk: [
        ...Object.values(state.households)
          .sort()
          .map((household_id) => ({ household_id, fold: "blabla", reason: "person" })),
        { household_id: null, fold: "stuk", reason: "seed" },
      ],
    };
  }

  const pick = (state: Awaited<ReturnType<typeof migrateWith>>) => ({
    ingredients: state.ingredients,
    aliases: state.aliases,
    changes: state.changes,
    junk: state.junk,
  });

  it("is the server owner's household where there is one", async () => {
    const state = await migrateWith([
      { id: "plain" },
      { id: "admin", admin: true },
      { id: "owner", owner: true },
    ]);

    expect(pick(state)).toEqual(heirsRows(state, state.households.owner!));
  });

  it("is the longest-standing admin's household without an owner", async () => {
    const state = await migrateWith([
      { id: "plain" },
      { id: "admin", admin: true },
      { id: "later-admin", admin: true },
    ]);

    expect(pick(state)).toEqual(heirsRows(state, state.households.admin!));
  });

  it("is the longest-standing account's household with only ordinary accounts", async () => {
    const state = await migrateWith([{ id: "first" }, { id: "second" }]);

    expect(pick(state)).toEqual(heirsRows(state, state.households.first!));
  });

  it("leaves only the seed on a server with no account at all", async () => {
    const state = await migrateWith([]);

    expect(pick(state)).toEqual(heirsRows(state, null));
  });
});
