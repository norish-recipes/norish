import type { Locator, Page } from "@playwright/test";
import { Client } from "pg";

import { databaseUrl } from "./database";

export interface ThrowawayUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

async function withDatabase<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    return await run(database);
  } finally {
    await database.end();
  }
}

/**
 * The server closes registration once it has an owner, and these scenarios
 * need accounts of their own to promote and delete without disturbing the
 * two the worker fixture signs everyone else in with.
 */
export async function enableRegistration(): Promise<void> {
  await withDatabase((database) =>
    database.query(
      `update server_config set value = 'true'::jsonb where key = 'registration_enabled'`
    )
  );
}

/**
 * Sign an account up through the real endpoint, so its email lands encrypted
 * and indexed exactly as any other account's does, and keep the id the
 * response hands back — the column is encrypted, so nothing can look it up
 * by address afterwards.
 */
export async function signUpThrowawayUser(
  baseURL: string,
  user: Omit<ThrowawayUser, "id">
): Promise<ThrowawayUser> {
  await enableRegistration();

  const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL },
    body: JSON.stringify({ email: user.email, password: user.password, name: user.name }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable>");

    throw new Error(`sign-up for ${user.email} failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { user?: { id?: string } };
  const id = payload.user?.id;

  if (!id) {
    throw new Error(`sign-up for ${user.email} returned no user id`);
  }

  return { ...user, id };
}

export async function seedHousehold(
  name: string,
  adminUserId: string,
  memberIds: readonly string[]
): Promise<string> {
  return withDatabase(async (database) => {
    const created = await database.query<{ id: string }>(
      `insert into households (name, admin_user_id) values ($1, $2) returning id`,
      [name, adminUserId]
    );
    const householdId = created.rows[0]!.id;

    for (const memberId of memberIds) {
      await database.query(`insert into household_users (household_id, user_id) values ($1, $2)`, [
        householdId,
        memberId,
      ]);
    }

    return householdId;
  });
}

export interface HouseholdSnapshot {
  adminUserId: string;
  memberIds: string[];
}

export async function readHousehold(householdId: string): Promise<HouseholdSnapshot | null> {
  return withDatabase(async (database) => {
    const household = await database.query<{ admin_user_id: string }>(
      `select admin_user_id from households where id = $1`,
      [householdId]
    );

    if (household.rowCount === 0) {
      return null;
    }

    const members = await database.query<{ user_id: string }>(
      `select user_id from household_users where household_id = $1 order by user_id`,
      [householdId]
    );

    return {
      adminUserId: household.rows[0]!.admin_user_id,
      memberIds: members.rows.map((row) => row.user_id),
    };
  });
}

export async function countUserRow(userId: string): Promise<number> {
  return withDatabase(async (database) => {
    const result = await database.query(`select 1 from "user" where id = $1`, [userId]);

    return result.rowCount ?? 0;
  });
}

/** The Users table on the admin settings page, once it has rendered. */
export async function openUsersTable(page: Page): Promise<Locator> {
  await page.goto("/settings?tab=admin");

  const table = page.getByRole("grid", { name: "Users" });

  await table.waitFor({ state: "visible", timeout: 30_000 });

  return table;
}

export function userRow(table: Locator, email: string): Locator {
  return table.getByRole("row").filter({ hasText: email });
}
