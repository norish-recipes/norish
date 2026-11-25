// @vitest-environment node
/**
 * Migration 0089 on a database seeded as earlier releases left it, one member's rows pointing into
 * the household they came from (ADR-0041); a second run changes nothing.
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
const MIGRATION_TAG = "0089_household_things_belong_to_the_household";

describe("household things belong to the household", () => {
  const testDbName = generateTestDbName("test_household_things");
  let pool: pg.Pool;

  const [ann, bob, cat] = ["user-ann", "user-bob", "user-cat"];
  const [shared, other] = [randomUUID(), randomUUID()];
  const id = () => randomUUID();
  const food = { milk: id(), eggs: id(), salt: id() };
  const store = { ann: id(), bob: id(), cat: id() };
  const recurring = { bob: id(), cat: id() };
  const grocery = { ann: id(), bob: id(), cat: id() };
  const pantry = { annMilk: id(), bobMilk: id(), bobEggs: id(), catMilk: id() };
  const plan = { ann: id(), bob: id(), cat: id() };
  const correction = { annMilk: id(), bobMilk: id(), catMilk: id() };
  const preference = { annMilk: id(), bobMilk: id(), bobEggs: id(), catSalt: id() };
  const aisle = { bob: id(), cat: id() };
  const aisleLink = { bob: id(), cat: id() };
  const product = { bob: id(), cat: id() };
  const productLink = { bob: id(), cat: id() };

  /** A Store's aisles, products and links as they stood: they follow their Store, untouched. */
  const storeKept = (table: string) =>
    rows(
      table,
      {
        aisles: "id, store_id, name",
        aisle_links: "id, store_id, ingredient_id, aisle_id",
        store_products: "id, store_id, name",
        store_product_links: "id, store_id, ingredient_id, store_product_id",
      }[table]!
    );
  const STORE_TABLES = ["aisles", "aisle_links", "store_products", "store_product_links"];

  async function applyMigration(tag: string): Promise<void> {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() === "") continue;

      await pool.query(statement);
    }
  }

  async function rows(table: string, columns: string): Promise<Record<string, unknown>[]> {
    const result = await pool.query(`SELECT ${columns} FROM ${table} ORDER BY id`);

    return result.rows;
  }

  const sorted = <T extends { id: string }>(list: T[]) =>
    [...list].sort((a, b) => a.id.localeCompare(b.id));

  /** Every row of the seven tables, to compare runs. */
  async function snapshot() {
    const tables = [
      "stores",
      "groceries",
      "recurring_groceries",
      "pantry_ingredients",
      "planned_items",
      "ingredient_nutrition_corrections",
      "ingredient_store_preferences",
    ];

    return Promise.all([...tables, ...STORE_TABLES].map((table) => rows(table, "*")));
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

    const q = (text: string, values: unknown[]) => pool.query(text, values);

    // The 0088 trigger gives each account a household of one; move them where the fixture wants.
    for (const userId of [ann, bob, cat]) {
      await q(`INSERT INTO "user" (id, name, email) VALUES ($1, 'enc', 'enc')`, [userId]);
    }
    await q("DELETE FROM households", []);
    await q("INSERT INTO households (id, name, admin_user_id) VALUES ($1, 'Shared', $2)", [
      shared,
      ann,
    ]);
    await q("INSERT INTO households (id, name, admin_user_id) VALUES ($1, 'Other', $2)", [
      other,
      cat,
    ]);
    await q(
      "INSERT INTO household_users (household_id, user_id) VALUES ($1, $2), ($1, $3), ($4, $5)",
      [shared, ann, bob, other, cat]
    );

    for (const [name, foodId] of Object.entries(food)) {
      await q("INSERT INTO ingredients (id, name) VALUES ($1, $2)", [foodId, `fixture ${name}`]);
    }

    for (const [owner, storeId] of Object.entries(store)) {
      await q("INSERT INTO stores (id, user_id, name) VALUES ($1, $2, $3)", [
        storeId,
        `user-${owner}`,
        `${owner}'s shop`,
      ]);
    }

    for (const [owner, recurringId] of Object.entries(recurring)) {
      await q(
        `INSERT INTO recurring_groceries (id, user_id, name, recurrence_rule, next_planned_for)
         VALUES ($1, $2, 'bread', 'week', '2026-01-01')`,
        [recurringId, `user-${owner}`]
      );
    }

    // Bob came from Cat's household: his grocery still points at her store and recurring grocery.
    await q(
      `INSERT INTO groceries (id, user_id, name, store_id, recurring_grocery_id) VALUES
       ($1, $2, 'milk', $3, NULL), ($4, $5, 'bread', $6, $7), ($8, $9, 'salt', $10, $11)`,
      [
        grocery.ann,
        ann,
        store.bob,
        grocery.bob,
        bob,
        store.cat,
        recurring.cat,
        grocery.cat,
        cat,
        store.cat,
        recurring.cat,
      ]
    );

    await q(
      `INSERT INTO pantry_ingredients (id, user_id, ingredient_id, created_at) VALUES
       ($1, $2, $3, '2025-01-01'), ($4, $5, $3, '2025-02-01'),
       ($6, $5, $7, '2025-02-01'), ($8, $9, $3, '2025-03-01')`,
      [
        pantry.annMilk,
        ann,
        food.milk,
        pantry.bobMilk,
        bob,
        pantry.bobEggs,
        food.eggs,
        pantry.catMilk,
        cat,
      ]
    );

    for (const [owner, planId] of Object.entries(plan)) {
      await q(
        `INSERT INTO planned_items (id, user_id, date, slot, item_type, title)
         VALUES ($1, $2, '2026-01-05', 'Dinner', 'note', $3)`,
        [planId, `user-${owner}`, `${owner}'s dinner`]
      );
    }

    await q(
      `INSERT INTO ingredient_nutrition_corrections (id, user_id, ingredient_id, kcal, updated_at) VALUES
       ($1, $2, $3, 40, '2025-01-01'), ($4, $5, $3, 60, '2025-06-01'), ($6, $7, $3, 50, '2025-01-01')`,
      [correction.annMilk, ann, food.milk, correction.bobMilk, bob, correction.catMilk, cat]
    );

    // Ann's milk preference is older than Bob's; Bob's eggs preference names Cat's store.
    await q(
      `INSERT INTO ingredient_store_preferences (id, user_id, ingredient_id, store_id, updated_at) VALUES
       ($1, $2, $3, $4, '2025-01-01'), ($5, $6, $3, $7, '2025-06-01'),
       ($8, $6, $9, $10, '2025-06-01'), ($11, $12, $13, $10, '2025-01-01')`,
      [
        preference.annMilk,
        ann,
        food.milk,
        store.ann,
        preference.bobMilk,
        bob,
        store.bob,
        preference.bobEggs,
        food.eggs,
        store.cat,
        preference.catSalt,
        cat,
        food.salt,
      ]
    );

    for (const owner of ["bob", "cat"] as const) {
      await q("INSERT INTO aisles (id, store_id, name) VALUES ($1, $2, 'Dairy')", [
        aisle[owner],
        store[owner],
      ]);
      await q(
        "INSERT INTO aisle_links (id, store_id, ingredient_id, aisle_id) VALUES ($1, $2, $3, $4)",
        [aisleLink[owner], store[owner], food.milk, aisle[owner]]
      );
      await q(
        `INSERT INTO store_products (id, store_id, name, price, currency)
         VALUES ($1, $2, 'Milk 1 L', 1.29, 'EUR')`,
        [product[owner], store[owner]]
      );
      await q(
        `INSERT INTO store_product_links (id, store_id, ingredient_id, store_product_id)
         VALUES ($1, $2, $3, $4)`,
        [productLink[owner], store[owner], food.milk, product[owner]]
      );
    }

    await applyMigration(MIGRATION_TAG);
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("gives each store, recurring grocery and plan entry its adder's household", async () => {
    expect(await rows("stores", "id, household_id, user_id")).toEqual(
      sorted([
        { id: store.ann, household_id: shared, user_id: ann },
        { id: store.bob, household_id: shared, user_id: bob },
        { id: store.cat, household_id: other, user_id: cat },
      ])
    );
    expect(await rows("recurring_groceries", "id, household_id, user_id")).toEqual(
      sorted([
        { id: recurring.bob, household_id: shared, user_id: bob },
        { id: recurring.cat, household_id: other, user_id: cat },
      ])
    );
    expect(await rows("planned_items", "id, household_id, user_id")).toEqual(
      sorted([
        { id: plan.ann, household_id: shared, user_id: ann },
        { id: plan.bob, household_id: shared, user_id: bob },
        { id: plan.cat, household_id: other, user_id: cat },
      ])
    );
  });

  it("unhooks a grocery from another household's store and recurring grocery", async () => {
    expect(
      await rows("groceries", "id, household_id, user_id, store_id, recurring_grocery_id")
    ).toEqual(
      sorted([
        {
          id: grocery.ann,
          household_id: shared,
          user_id: ann,
          store_id: store.bob,
          recurring_grocery_id: null,
        },
        {
          id: grocery.bob,
          household_id: shared,
          user_id: bob,
          store_id: null,
          recurring_grocery_id: null,
        },
        {
          id: grocery.cat,
          household_id: other,
          user_id: cat,
          store_id: store.cat,
          recurring_grocery_id: recurring.cat,
        },
      ])
    );
  });

  it("keeps a household's first Pantry row of a food", async () => {
    expect(await rows("pantry_ingredients", "id, household_id, user_id, ingredient_id")).toEqual(
      sorted([
        { id: pantry.annMilk, household_id: shared, user_id: ann, ingredient_id: food.milk },
        { id: pantry.bobEggs, household_id: shared, user_id: bob, ingredient_id: food.eggs },
        { id: pantry.catMilk, household_id: other, user_id: cat, ingredient_id: food.milk },
      ])
    );
  });

  it("keeps a household's most recent correction of a food", async () => {
    expect(
      await rows("ingredient_nutrition_corrections", "id, household_id, user_id, kcal")
    ).toEqual(
      sorted([
        { id: correction.bobMilk, household_id: shared, user_id: bob, kcal: 60 },
        { id: correction.catMilk, household_id: other, user_id: cat, kcal: 50 },
      ])
    );
  });

  it("keeps a store preference with its store's household, the most recent per food", async () => {
    expect(
      await rows(
        "ingredient_store_preferences",
        "id, household_id, user_id, ingredient_id, store_id"
      )
    ).toEqual(
      sorted([
        {
          id: preference.bobMilk,
          household_id: shared,
          user_id: bob,
          ingredient_id: food.milk,
          store_id: store.bob,
        },
        {
          id: preference.bobEggs,
          household_id: other,
          user_id: bob,
          ingredient_id: food.eggs,
          store_id: store.cat,
        },
        {
          id: preference.catSalt,
          household_id: other,
          user_id: cat,
          ingredient_id: food.salt,
          store_id: store.cat,
        },
      ])
    );
  });

  it("refuses a second Pantry row or correction of one food in a household", async () => {
    await expect(
      pool.query(
        "INSERT INTO pantry_ingredients (household_id, user_id, ingredient_id) VALUES ($1, $2, $3)",
        [shared, bob, food.milk]
      )
    ).rejects.toThrow(/uq_pantry_ingredients_household_ingredient/);
    await expect(
      pool.query(
        "INSERT INTO ingredient_nutrition_corrections (household_id, user_id, ingredient_id) VALUES ($1, $2, $3)",
        [shared, ann, food.milk]
      )
    ).rejects.toThrow(/uq_ingredient_nutrition_corrections_household_ingredient/);
  });

  /** Every Store's aisles, products and links, by table. */
  const storeRows = () => Promise.all(STORE_TABLES.map(storeKept));
  const asSeeded = () =>
    [
      (["bob", "cat"] as const).map((owner) => ({
        id: aisle[owner],
        store_id: store[owner],
        name: "Dairy",
      })),
      (["bob", "cat"] as const).map((owner) => ({
        id: aisleLink[owner],
        store_id: store[owner],
        ingredient_id: food.milk,
        aisle_id: aisle[owner],
      })),
      (["bob", "cat"] as const).map((owner) => ({
        id: product[owner],
        store_id: store[owner],
        name: "Milk 1 L",
      })),
      (["bob", "cat"] as const).map((owner) => ({
        id: productLink[owner],
        store_id: store[owner],
        ingredient_id: food.milk,
        store_product_id: product[owner],
      })),
    ].map(sorted);

  it("keeps each Store's aisles, products and links with their ids and references", async () => {
    expect(await storeRows()).toEqual(asSeeded());
  });

  it("changes nothing when it runs again", async () => {
    const before = await snapshot();

    await applyMigration(MIGRATION_TAG);

    expect(await snapshot()).toEqual(before);
    expect(await storeRows()).toEqual(asSeeded());
  });
});
