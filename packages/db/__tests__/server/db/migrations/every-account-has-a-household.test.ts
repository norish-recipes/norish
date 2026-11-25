// @vitest-environment node
/**
 * Every account is in exactly one household (ADR-0041).
 *
 * Run against a database migrated up to the migration before it, seeded with
 * accounts as earlier releases left them: some in a household, some in none,
 * some in two, and households whose admin no longer lives there. Applying the
 * migration a second time changes nothing.
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
const MIGRATION_TAG = "0088_every_account_has_a_household";

describe("every account has a household", () => {
  const testDbName = generateTestDbName("test_every_account_has_a_household");
  let pool: pg.Pool;

  const users = {
    admin: "user-admin",
    member: "user-member",
    alone: "user-alone",
    secondAlone: "user-second-alone",
    inTwo: "user-in-two",
    displacedAdmin: "user-displaced-admin",
    elder: "user-elder",
    younger: "user-younger",
    formerAdmin: "user-former-admin",
    lodgerEarly: "user-lodger-early",
    lodgerLate: "user-lodger-late",
  };
  const shared = randomUUID();
  const first = randomUUID();
  const later = randomUUID();
  const home = randomUUID();
  const displaced = randomUUID();
  const adminless = randomUUID();

  async function applyMigration(tag: string): Promise<void> {
    const sql = await readFile(resolve(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim() === "") continue;

      await pool.query(statement);
    }
  }

  async function householdsOf(userId: string) {
    const result = await pool.query<{ id: string; name: string; admin_user_id: string }>(
      `SELECT h.id, h.name, h.admin_user_id FROM household_users hu
       JOIN households h ON h.id = hu.household_id WHERE hu.user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  async function memberIdsOf(householdId: string): Promise<string[]> {
    const result = await pool.query<{ user_id: string }>(
      "SELECT user_id FROM household_users WHERE household_id = $1 ORDER BY user_id",
      [householdId]
    );

    return result.rows.map((row) => row.user_id);
  }

  /** Every household and membership, to compare runs row by row. */
  async function snapshot() {
    const households = await pool.query("SELECT * FROM households ORDER BY id");
    const members = await pool.query(
      "SELECT * FROM household_users ORDER BY household_id, user_id"
    );

    return { households: households.rows, members: members.rows };
  }

  async function adminOf(householdId: string): Promise<string | undefined> {
    const result = await pool.query<{ admin_user_id: string }>(
      "SELECT admin_user_id FROM households WHERE id = $1",
      [householdId]
    );

    return result.rows[0]?.admin_user_id;
  }

  async function count(table: string): Promise<number> {
    const result = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);

    return result.rows[0]!.n;
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

    for (const id of Object.values(users)) {
      await pool.query(
        `INSERT INTO "user" (id, name, email) VALUES ($1, 'enc-name', 'enc-email')`,
        [id]
      );
    }

    const household = (id: string, name: string, adminId: string) =>
      pool.query("INSERT INTO households (id, name, admin_user_id) VALUES ($1, $2, $3)", [
        id,
        name,
        adminId,
      ]);
    const member = (householdId: string, userId: string, createdAt: string) =>
      pool.query(
        "INSERT INTO household_users (household_id, user_id, created_at) VALUES ($1, $2, $3)",
        [householdId, userId, createdAt]
      );

    await household(shared, "The Burrow", users.admin);
    await member(shared, users.admin, "2024-01-01");
    await member(shared, users.member, "2024-01-02");
    // Nothing stopped two memberships before; the first one is kept.
    await household(first, "First", users.inTwo);
    await member(first, users.inTwo, "2024-02-01");
    await household(later, "Later", users.inTwo);
    await member(later, users.inTwo, "2024-03-01");
    // The admin is taken out of the household they joined later; the role passes on.
    await household(home, "Home", users.displacedAdmin);
    await member(home, users.displacedAdmin, "2024-01-15");
    await household(displaced, "Displaced", users.displacedAdmin);
    await member(displaced, users.displacedAdmin, "2024-04-01");
    await member(displaced, users.younger, "2024-04-03");
    await member(displaced, users.elder, "2024-04-02");
    // An admin who left without handing the role on.
    await household(adminless, "Adminless", users.formerAdmin);
    await member(adminless, users.lodgerLate, "2024-05-02");
    await member(adminless, users.lodgerEarly, "2024-05-01");

    await applyMigration(MIGRATION_TAG);
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await teardownTestDatabase(testDbName);
  });

  it("keeps a shared household as it was", async () => {
    expect(await memberIdsOf(shared)).toEqual([users.admin, users.member].sort());
    expect((await householdsOf(users.admin))[0]).toMatchObject({ id: shared, name: "The Burrow" });
  });

  it("gives an account without a household a household of one it administers", async () => {
    for (const userId of [users.alone, users.secondAlone]) {
      const [own, ...more] = await householdsOf(userId);

      expect(more).toEqual([]);
      expect(own).toMatchObject({ name: "My household", admin_user_id: userId });
      expect(await memberIdsOf(own!.id)).toEqual([userId]);
    }

    const [alone] = await householdsOf(users.alone);
    const [secondAlone] = await householdsOf(users.secondAlone);

    expect(alone!.id).not.toBe(secondAlone!.id);
  });

  it("keeps an account in two households in its first, and drops the emptied one", async () => {
    expect((await householdsOf(users.inTwo)).map((h) => h.id)).toEqual([first]);
    expect(await count(`households WHERE id = '${later}'`)).toBe(0);
  });

  it("hands a displaced admin's role to the longest-standing member who stays", async () => {
    expect(await memberIdsOf(displaced)).toEqual([users.elder, users.younger].sort());
    expect(await adminOf(displaced)).toBe(users.elder);
    expect(await adminOf(home)).toBe(users.displacedAdmin);
  });

  it("hands the role on in a household whose admin no longer lives there", async () => {
    expect(await adminOf(adminless)).toBe(users.lodgerEarly);
    expect((await householdsOf(users.formerAdmin))[0]).toMatchObject({
      name: "My household",
      admin_user_id: users.formerAdmin,
    });
  });

  it("leaves every household with an admin who is one of its members", async () => {
    expect(
      await count(`households h WHERE NOT EXISTS (
        SELECT 1 FROM household_users hu
        WHERE hu.household_id = h.id AND hu.user_id = h.admin_user_id)`)
    ).toBe(0);
  });

  it("refuses a second membership from here on", async () => {
    await expect(
      pool.query("INSERT INTO household_users (household_id, user_id) VALUES ($1, $2)", [
        shared,
        users.alone,
      ])
    ).rejects.toThrow(/uq_household_users_user_id/);
  });

  it("gives an account created afterwards its household of one in the same insert", async () => {
    await pool.query(`INSERT INTO "user" (id, name, email) VALUES ('user-new', 'n', 'e')`);

    const [own] = await householdsOf("user-new");

    expect(own).toMatchObject({ name: "My household", admin_user_id: "user-new" });
  });

  it("changes nothing when it runs again", async () => {
    const before = await snapshot();

    await applyMigration(MIGRATION_TAG);

    expect(await snapshot()).toEqual(before);
  });
});
