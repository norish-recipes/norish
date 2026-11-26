// @vitest-environment node
/** Migration 0090 on an earlier release's database: orphaned recipes and cookbooks go to an heir,
 * every row takes its Owner's household, and a rerun changes nothing. */

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
const MIGRATION_TAG = "0090_recipes_carry_their_owners_household";

type User = { id: string; owner?: boolean; admin?: boolean; createdAt: string };

/** A database migrated up to just before 0090, each account alone in its household unless placed. */
async function databaseBefore(name: string) {
  const testDbName = generateTestDbName(name);
  const pool = new pg.Pool({ connectionString: await createTestDatabase(testDbName) });
  const journal = JSON.parse(
    await readFile(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")
  ) as { entries: { tag: string }[] };
  const index = journal.entries.findIndex((entry) => entry.tag === MIGRATION_TAG);

  expect(index).toBeGreaterThan(0);

  const apply = async (tag: string) => {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() !== "") await pool.query(statement);
    }
  };

  for (const entry of journal.entries.slice(0, index)) await apply(entry.tag);

  return {
    pool,
    migrate: () => apply(MIGRATION_TAG),
    q: (text: string, values: unknown[] = []) => pool.query(text, values),
    async addUsers(users: User[]) {
      for (const user of users) {
        await pool.query(
          `INSERT INTO "user" (id, name, email, "isServerOwner", "isServerAdmin", "createdAt")
           VALUES ($1, 'enc', 'enc', $2, $3, $4)`,
          [user.id, user.owner ?? false, user.admin ?? false, user.createdAt]
        );
      }
    },
    async householdOf(userId: string): Promise<string> {
      const result = await pool.query(
        "SELECT household_id FROM household_users WHERE user_id = $1",
        [userId]
      );

      return result.rows[0].household_id;
    },
    teardown: async () => {
      await pool.end();
      await teardownTestDatabase(testDbName);
    },
  };
}

describe("recipes and cookbooks carry their Owner's household", () => {
  let db: Awaited<ReturnType<typeof databaseBefore>>;
  const [owner, ann, bob] = ["user-owner", "user-ann", "user-bob"];
  const shared = randomUUID();
  const recipe = {
    annSoup: randomUUID(),
    bobStew: randomUUID(),
    ownerPie: randomUUID(),
    orphanPie: randomUUID(),
    orphanTartOld: randomUUID(),
    orphanTartNew: randomUUID(),
    orphanBread: randomUUID(),
  };
  const cookbook = { ann: randomUUID(), orphan: randomUUID() };
  const membership = { annHoldsBob: randomUUID(), orphanHoldsAnn: randomUUID() };
  let other: string;

  const recipeRows = async () =>
    (await db.q("SELECT id, user_id, household_id, url FROM recipes ORDER BY id")).rows;
  const cookbookRows = async () =>
    (await db.q("SELECT id, user_id, household_id FROM cookbooks ORDER BY id")).rows;
  const membershipRows = async () =>
    (await db.q("SELECT id, cookbook_id, recipe_id FROM cookbook_recipes ORDER BY id")).rows;
  const sorted = <T extends { id: string }>(list: T[]) =>
    [...list].sort((a, b) => a.id.localeCompare(b.id));

  beforeAll(async () => {
    db = await databaseBefore("test_recipes_owner_household");
    await db.addUsers([
      { id: owner, owner: true, createdAt: "2025-03-01" },
      { id: ann, admin: true, createdAt: "2025-01-01" },
      { id: bob, createdAt: "2025-02-01" },
    ]);
    // The owner and Ann share a household; Bob keeps the household of one sign-up made him.
    await db.q("DELETE FROM households WHERE admin_user_id IN ($1, $2)", [owner, ann]);
    await db.q("INSERT INTO households (id, name, admin_user_id) VALUES ($1, 'Shared', $2)", [
      shared,
      ann,
    ]);
    await db.q("INSERT INTO household_users (household_id, user_id) VALUES ($1, $2), ($1, $3)", [
      shared,
      owner,
      ann,
    ]);
    other = await db.householdOf(bob);

    const add = (id: string, userId: string | null, url: string | null, createdAt: string) =>
      db.q(
        "INSERT INTO recipes (id, user_id, name, url, created_at) VALUES ($1, $2, 'x', $3, $4)",
        [id, userId, url, createdAt]
      );

    await add(recipe.annSoup, ann, "https://a.test/soup", "2025-01-01");
    await add(recipe.bobStew, bob, null, "2025-01-01");
    await add(recipe.ownerPie, owner, "https://a.test/pie", "2025-01-01");
    // An orphan with the URL the owner already has, two orphans sharing one, one without.
    await add(recipe.orphanPie, null, "https://a.test/pie", "2025-01-02");
    await add(recipe.orphanTartOld, null, "https://a.test/tart", "2025-01-02");
    await add(recipe.orphanTartNew, null, "https://a.test/tart", "2025-01-03");
    await add(recipe.orphanBread, null, null, "2025-01-03");

    await db.q(
      "INSERT INTO cookbooks (id, user_id, title) VALUES ($1, $2, 'Ann'), ($3, NULL, 'Old')",
      [cookbook.ann, ann, cookbook.orphan]
    );
    // Ann's cookbook holds Bob's recipe; the orphaned one holds Ann's.
    await db.q(
      `INSERT INTO cookbook_recipes (id, cookbook_id, recipe_id) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [
        membership.annHoldsBob,
        cookbook.ann,
        recipe.bobStew,
        membership.orphanHoldsAnn,
        cookbook.orphan,
        recipe.annSoup,
      ]
    );

    await db.migrate();
  });

  afterAll(async () => {
    await db.teardown();
  });

  it("gives every recipe its Owner's household and Orphans to the server owner", async () => {
    expect(await recipeRows()).toEqual(
      sorted([
        { id: recipe.annSoup, user_id: ann, household_id: shared, url: "https://a.test/soup" },
        { id: recipe.bobStew, user_id: bob, household_id: other, url: null },
        { id: recipe.ownerPie, user_id: owner, household_id: shared, url: "https://a.test/pie" },
        // The owner already had this URL: the orphan keeps everything but it.
        { id: recipe.orphanPie, user_id: owner, household_id: shared, url: null },
        {
          id: recipe.orphanTartOld,
          user_id: owner,
          household_id: shared,
          url: "https://a.test/tart",
        },
        { id: recipe.orphanTartNew, user_id: owner, household_id: shared, url: null },
        { id: recipe.orphanBread, user_id: owner, household_id: shared, url: null },
      ])
    );
  });

  it("gives every cookbook its Owner's household and leaves memberships alone", async () => {
    expect(await cookbookRows()).toEqual(
      sorted([
        { id: cookbook.ann, user_id: ann, household_id: shared },
        { id: cookbook.orphan, user_id: owner, household_id: shared },
      ])
    );
    expect(await membershipRows()).toEqual(
      sorted([
        { id: membership.annHoldsBob, cookbook_id: cookbook.ann, recipe_id: recipe.bobStew },
        { id: membership.orphanHoldsAnn, cookbook_id: cookbook.orphan, recipe_id: recipe.annSoup },
      ])
    );
  });

  it("changes nothing on a second run", async () => {
    const before = [await recipeRows(), await cookbookRows(), await membershipRows()];

    await db.migrate();

    expect([await recipeRows(), await cookbookRows(), await membershipRows()]).toEqual(before);
  }, 30_000);

  it("refuses a recipe without an Owner", async () => {
    await expect(
      db.q("INSERT INTO recipes (id, user_id, name) VALUES ($1, NULL, 'x')", [randomUUID()])
    ).rejects.toThrow(/null value/);
  });

  it("keeps a row in its Owner's household whatever a write says", async () => {
    const id = randomUUID();

    await db.q("INSERT INTO recipes (id, user_id, household_id, name) VALUES ($1, $2, $3, 'x')", [
      id,
      bob,
      shared,
    ]);
    await db.q("UPDATE recipes SET household_id = $2 WHERE id = $1", [id, shared]);

    const { rows } = await db.q("SELECT household_id FROM recipes WHERE id = $1", [id]);

    expect(rows).toEqual([{ household_id: other }]);
  });
});

describe("the Orphans' heir without a server owner", () => {
  const cases: Array<{ name: string; users: User[]; heir: string | null }> = [
    {
      name: "the longest-standing admin",
      users: [
        { id: "user-a", createdAt: "2025-01-01" },
        { id: "user-b", admin: true, createdAt: "2025-03-01" },
        { id: "user-c", admin: true, createdAt: "2025-02-01" },
      ],
      heir: "user-c",
    },
    {
      name: "the longest-standing account",
      users: [
        { id: "user-b", createdAt: "2025-02-01" },
        { id: "user-a", createdAt: "2025-01-01" },
      ],
      heir: "user-a",
    },
    { name: "nobody, on a server without accounts", users: [], heir: null },
  ];

  it.each(cases)("is $name", async ({ users, heir }) => {
    const db = await databaseBefore("test_orphan_heir");

    try {
      await db.addUsers(users);
      const [orphanRecipe, orphanCookbook] = [randomUUID(), randomUUID()];

      await db.q("INSERT INTO recipes (id, user_id, name) VALUES ($1, NULL, 'x')", [orphanRecipe]);
      await db.q("INSERT INTO cookbooks (id, user_id, title) VALUES ($1, NULL, 'x')", [
        orphanCookbook,
      ]);
      await db.migrate();

      const recipes = (await db.q("SELECT id, user_id, household_id FROM recipes")).rows;
      const cookbooks = (await db.q("SELECT id, user_id, household_id FROM cookbooks")).rows;

      if (heir === null) {
        expect([recipes, cookbooks]).toEqual([[], []]);
      } else {
        const household = await db.householdOf(heir);

        expect(recipes).toEqual([{ id: orphanRecipe, user_id: heir, household_id: household }]);
        expect(cookbooks).toEqual([{ id: orphanCookbook, user_id: heir, household_id: household }]);
      }
    } finally {
      await db.teardown();
    }
  });
});
