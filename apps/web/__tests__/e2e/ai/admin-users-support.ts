import type { Locator, Page } from "@playwright/test";

import type { AdminUserRowDTO } from "@norish/shared/contracts";
import {
  addUserToHousehold,
  createHousehold,
  getHouseholdById,
  getUsersByHouseholdId,
} from "@norish/db/repositories/households";

import type { AIE2EStack } from "./fixture";
import { userIdOf } from "../harness/accounts";
import { callTrpc } from "../harness/trpc";

type Owner = Pick<AIE2EStack, "baseURL" | "ownerCookies">;

export interface ThrowawayUser {
  id: string;
  email: string;
  password: string;
  name: string;
}

/**
 * The server closes registration once it has an owner, and these scenarios
 * need accounts of their own to promote and delete without disturbing the
 * two the worker fixture signs everyone else in with.
 */
export async function enableRegistration(stack: Owner): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "admin.updateRegistration", true);
}

/** Sign an account up through the real endpoint, so its email lands encrypted as any other's. */
export async function signUpThrowawayUser(
  stack: Owner,
  user: Omit<ThrowawayUser, "id">
): Promise<ThrowawayUser> {
  await enableRegistration(stack);

  const response = await fetch(`${stack.baseURL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: stack.baseURL },
    body: JSON.stringify({ email: user.email, password: user.password, name: user.name }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable>");

    throw new Error(`sign-up for ${user.email} failed: ${response.status} ${body}`);
  }

  return { ...user, id: await userIdOf(user) };
}

/** A household of other accounts, which the owner can neither make nor read through the app. */
export async function seedHousehold(
  name: string,
  adminUserId: string,
  memberIds: readonly string[]
): Promise<string> {
  const { id } = await createHousehold({ name, adminUserId });

  for (const userId of memberIds) await addUserToHousehold({ householdId: id, userId });

  return id;
}

export interface HouseholdSnapshot {
  adminUserId: string;
  memberIds: string[];
}

export async function readHousehold(householdId: string): Promise<HouseholdSnapshot | null> {
  const household = await getHouseholdById(householdId);

  if (!household) return null;

  return {
    adminUserId: household.adminUserId,
    memberIds: (await getUsersByHouseholdId(householdId))
      .map((member) => member.userId)
      .sort((a, b) => a.localeCompare(b)),
  };
}

/** How many accounts the admin's Users list shows with this id. */
export async function countUserRow(stack: Owner, userId: string): Promise<number> {
  const rows = await callTrpc<AdminUserRowDTO[]>(
    stack.baseURL,
    stack.ownerCookies,
    "admin.users.list"
  );

  return rows.filter((row) => row.id === userId).length;
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
