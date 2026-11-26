// @vitest-environment node
/**
 * Migration 0092 and the 0.28 boot upgrade on lists of earlier releases: shared Tag and Category
 * rows split per household (the oldest recipe's household keeps the id), rows folding alike merge,
 * built-ins and Cuisines become instance entries, a household row folding like a built-in merges
 * into it, allergies become names; a second run changes nothing, and every stored fold is
 * `entryFold` of its name.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resetDbConnection } from "@norish/db/drizzle";
import { foldPendingListEntries } from "@norish/db/repositories/upgrades";
import { entryFold } from "@norish/shared/lib/fold-name";

import {
  createTestDatabase,
  generateTestDbName,
  teardownTestDatabase,
} from "../../../helpers/db-setup";

const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../src/migrations"
);
const MIGRATION_TAG = "0092_household_lists";

/** Names whose fold SQL and JavaScript could disagree on; ASCII ones fold in SQL, the rest at boot. */
const AWKWARD_NAMES = [
  "BBQ",
  "  Spaced   Out  ",
  "tab\there",
  "100% Rye!",
  "a^b`c",
  "--",
  "Crème Brûlée",
  "Æbleskiver",
  "ﬁsh soup",
  "Straße",
  "İstanbul",
  "Ǆemal",
  "🔥",
  "🌶️ Hot",
  "日本料理",
  "Ελληνική",
  "Ру́сская",
];

describe("Tags, Cuisines and Categories become household lists", () => {
  const testDbName = generateTestDbName("test_household_lists");
  const originalUrl = SERVER_CONFIG.DATABASE_URL;
  let pool: pg.Pool;
  const q = (text: string, values: unknown[] = []) => pool.query(text, values);
  const [ann, bob] = ["user-ann", "user-bob"];
  const recipe = {
    annOld: randomUUID(),
    annNew: randomUUID(),
    bob: randomUUID(),
    bob2: randomUUID(),
  };
  const tag = {
    soja: randomUUID(),
    glutenFree: randomUUID(),
    glutenFreeSpaced: randomUUID(),
    cafe: randomUUID(),
    cafeAccented: randomUUID(),
    unused: randomUUID(),
    peanuts: randomUUID(),
  };
  const category = {
    drinks: randomUUID(),
    unused: randomUUID(),
    breakfastBang: randomUUID(),
    breakfastAccented: randomUUID(),
  };
  const cuisine = randomUUID();
  let households: { ann: string; bob: string };

  async function apply(tag: string) {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() !== "") await pool.query(statement);
    }
  }

  const upgrade = async () => {
    await apply(MIGRATION_TAG);
    await foldPendingListEntries();
  };

  const listRows = async (table: string) =>
    (await q(`SELECT id, household_id, name, name_fold FROM ${table} ORDER BY household_id, name`))
      .rows;
  const links = async (table: string, column: string, entities: string) =>
    (
      await q(
        `SELECT l.recipe_id, e.id AS entity_id, e.household_id FROM ${table} l
         JOIN ${entities} e ON e.id = l.${column} ORDER BY l.recipe_id, e.name`
      )
    ).rows;
  const snapshot = async () => ({
    tags: await listRows("tags"),
    categories: await listRows("categories"),
    cuisines: await listRows("cuisines"),
    recipeTags: await links("recipe_tags", "tag_id", "tags"),
    recipeCategories: await links("recipe_categories", "category_id", "categories"),
    recipeCuisines: await links("recipe_cuisines", "cuisine_id", "cuisines"),
    allergies: (await q("SELECT user_id, name FROM user_allergies ORDER BY user_id, name")).rows,
  });

  beforeAll(async () => {
    const url = await createTestDatabase(testDbName);

    pool = new pg.Pool({ connectionString: url });
    SERVER_CONFIG.DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    await resetDbConnection();

    const journal = JSON.parse(
      await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
    ) as { entries: { tag: string }[] };
    const index = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

    expect(index).toBeGreaterThan(0);
    for (const entry of journal.entries.slice(0, index)) await apply(entry.tag);

    for (const id of [ann, bob]) {
      await q(
        `INSERT INTO "user" (id, name, email, "createdAt") VALUES ($1, 'enc', 'enc', now())`,
        [id]
      );
    }
    const householdOf = async (userId: string) =>
      (await q("SELECT household_id FROM household_users WHERE user_id = $1", [userId])).rows[0]
        .household_id as string;

    households = { ann: await householdOf(ann), bob: await householdOf(bob) };

    await q(
      `INSERT INTO recipes (id, user_id, name, created_at) VALUES
       ($1, $5, 'Old', '2025-01-01'), ($2, $5, 'New', '2025-03-01'),
       ($3, $6, 'Bob', '2025-02-01'), ($4, $6, 'Bob 2', '2025-04-01')`,
      [recipe.annOld, recipe.annNew, recipe.bob, recipe.bob2, ann, bob]
    );
    // The old index was unique on lower(name): only names folding alike, not just by case, met.
    await q(
      `INSERT INTO tags (id, name, created_at) VALUES
       ($1, 'soja', '2025-01-01'), ($2, 'Gluten-free', '2025-01-02'), ($3, 'gluten free', '2025-01-03'),
       ($4, 'cafe', '2025-01-05'), ($5, 'Café', '2025-01-04'), ($6, 'lonely', '2025-01-01'),
       ($7, 'Peanuts', '2025-01-01')`,
      [
        tag.soja,
        tag.glutenFree,
        tag.glutenFreeSpaced,
        tag.cafe,
        tag.cafeAccented,
        tag.unused,
        tag.peanuts,
      ]
    );
    await q(
      `INSERT INTO recipe_tags (recipe_id, tag_id, "order") VALUES
       ($1, $5, 0), ($1, $6, 1), ($1, $7, 2), ($2, $7, 0), ($3, $5, 0), ($3, $8, 1), ($4, $9, 0)`,
      [
        recipe.annOld,
        recipe.annNew,
        recipe.bob,
        recipe.bob2,
        tag.soja,
        tag.glutenFree,
        tag.glutenFreeSpaced,
        tag.cafe,
        tag.cafeAccented,
      ]
    );
    await q(
      `INSERT INTO categories (id, name) VALUES
       ($1, 'Drinks'), ($2, 'Unused'), ($3, 'Breakfast!'), ($4, 'Bréakfast')`,
      [category.drinks, category.unused, category.breakfastBang, category.breakfastAccented]
    );
    await q(
      `INSERT INTO recipe_categories (recipe_id, category_id, "order") VALUES
       ($1, $3, 1), ($2, $4, 1), ($2, (SELECT id FROM categories WHERE name = 'Breakfast'), 2)`,
      [recipe.annOld, recipe.bob, category.breakfastBang, category.breakfastAccented]
    );
    await q(
      `INSERT INTO recipe_categories (recipe_id, category_id, "order")
       SELECT r, c.id, 0 FROM unnest($1::uuid[]) r, categories c WHERE c.name IN ('Dinner', 'Drinks')`,
      [[recipe.annOld, recipe.bob]]
    );
    await q("INSERT INTO cuisines (id, name) VALUES ($1, 'Fusion')", [cuisine]);
    await q(`INSERT INTO recipe_cuisines (recipe_id, cuisine_id) VALUES ($1, $3), ($2, $3)`, [
      recipe.annOld,
      recipe.bob,
      cuisine,
    ]);
    await q(`INSERT INTO user_allergies (user_id, tag_id) VALUES ($1, $3), ($2, $4)`, [
      ann,
      bob,
      tag.soja,
      tag.peanuts,
    ]);
    for (const name of AWKWARD_NAMES) await q("INSERT INTO cuisines (name) VALUES ($1)", [name]);

    await upgrade();
  });

  afterAll(async () => {
    await pool.end();
    SERVER_CONFIG.DATABASE_URL = originalUrl;
    process.env.DATABASE_URL = originalUrl;
    await resetDbConnection();
    await teardownTestDatabase(testDbName);
  });

  it("gives each household its own copy of a shared Tag, the oldest recipe's keeping the id", async () => {
    const soja = (await listRows("tags")).filter((row) => row.name === "soja");

    expect(soja).toEqual(
      expect.arrayContaining([
        { id: tag.soja, household_id: households.ann, name: "soja", name_fold: "soja" },
        expect.objectContaining({ household_id: households.bob, name: "soja", name_fold: "soja" }),
      ])
    );
    expect(soja).toHaveLength(2);

    const bobSoja = soja.find((row) => row.household_id === households.bob)!;

    expect(await links("recipe_tags", "tag_id", "tags")).toEqual(
      expect.arrayContaining([
        { recipe_id: recipe.annOld, entity_id: tag.soja, household_id: households.ann },
        { recipe_id: recipe.bob, entity_id: bobSoja.id, household_id: households.bob },
      ])
    );
  });

  it("merges a household's rows folding alike onto the older, without duplicate links", async () => {
    const tags = await listRows("tags");

    expect(tags.filter((row) => row.household_id === households.ann)).toEqual([
      {
        id: tag.glutenFree,
        household_id: households.ann,
        name: "Gluten-free",
        name_fold: "gluten free",
      },
      { id: tag.soja, household_id: households.ann, name: "soja", name_fold: "soja" },
    ]);
    expect(tags.filter((row) => row.household_id === households.bob)).toEqual([
      // "Café" is older than "cafe", so it keeps its id; its fold is the boot upgrade's.
      { id: tag.cafeAccented, household_id: households.bob, name: "Café", name_fold: "cafe" },
      expect.objectContaining({ household_id: households.bob, name: "soja" }),
    ]);

    const recipeTags = await links("recipe_tags", "tag_id", "tags");

    expect(recipeTags.filter((row) => row.recipe_id === recipe.annOld)).toHaveLength(2);
    expect(recipeTags).toContainEqual({
      recipe_id: recipe.annNew,
      entity_id: tag.glutenFree,
      household_id: households.ann,
    });
    expect(recipeTags.filter((row) => row.entity_id === tag.cafeAccented)).toHaveLength(2);
  });

  it("drops the rows no recipe carries, and keeps every allergy as a name", async () => {
    const tagIds = (await listRows("tags")).map((row) => row.id);

    expect(tagIds).not.toContain(tag.unused);
    expect(tagIds).not.toContain(tag.peanuts);
    expect((await listRows("categories")).map((row) => row.id)).not.toContain(category.unused);
    expect((await q("SELECT user_id, name FROM user_allergies ORDER BY user_id")).rows).toEqual([
      { user_id: ann, name: "soja" },
      { user_id: bob, name: "Peanuts" },
    ]);
  });

  it("splits a household Category, and keeps built-ins and Cuisines instance entries", async () => {
    const categories = await listRows("categories");

    expect(
      categories
        .filter((row) => row.household_id === null)
        .map((row) => row.name)
        .sort()
    ).toEqual(["Breakfast", "Dinner", "Lunch", "Snack"]);
    const drinks = categories.filter((row) => row.name === "Drinks");

    expect(drinks).toHaveLength(2);
    expect(drinks).toEqual(
      expect.arrayContaining([
        { id: category.drinks, household_id: households.ann, name: "Drinks", name_fold: "drinks" },
        expect.objectContaining({ household_id: households.bob, name: "Drinks" }),
      ])
    );

    const dinner = categories.find((row) => row.name === "Dinner")!;
    const recipeCategories = await links("recipe_categories", "category_id", "categories");

    expect(recipeCategories.filter((row) => row.entity_id === dinner.id)).toHaveLength(2);
    expect(await listRows("cuisines")).toContainEqual({
      id: cuisine,
      household_id: null,
      name: "Fusion",
      name_fold: "fusion",
    });
    expect(
      (await links("recipe_cuisines", "cuisine_id", "cuisines")).map((row) => row.entity_id)
    ).toEqual([cuisine, cuisine]);
  });

  it("merges a household Category folding like a built-in into the built-in", async () => {
    const categories = await listRows("categories");
    const breakfast = categories.find((row) => row.name === "Breakfast")!;

    expect(categories.filter((row) => row.name_fold === "breakfast")).toEqual([
      expect.objectContaining({ id: breakfast.id, household_id: null }),
    ]);
    expect(
      (await links("recipe_categories", "category_id", "categories")).filter(
        (row) => row.entity_id === breakfast.id
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipe_id: recipe.annOld }),
        expect.objectContaining({ recipe_id: recipe.bob }),
      ])
    );
    expect(
      (await links("recipe_categories", "category_id", "categories")).filter(
        (row) => row.entity_id === breakfast.id
      )
    ).toHaveLength(2);
  });

  it("stores entryFold of every name, in SQL and at boot alike", async () => {
    const rows = (
      await q("SELECT name, name_fold FROM cuisines WHERE name = ANY($1)", [AWKWARD_NAMES])
    ).rows as Array<{ name: string; name_fold: string }>;

    expect(rows).toHaveLength(AWKWARD_NAMES.length);
    for (const row of rows)
      expect([row.name, row.name_fold]).toEqual([row.name, entryFold(row.name)]);
  });

  it("changes nothing on a second run", async () => {
    const first = await snapshot();

    await upgrade();

    expect(await snapshot()).toEqual(first);
  });
});
