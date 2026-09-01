/**
 * Administering the people on a server, proven against a real database.
 *
 * The two facts worth a browser here are the ones no unit test can reach:
 * what an administrator sees about every account, and what the database
 * looks like afterwards when one of those accounts is deleted. The second is
 * a regression guard — `households.admin_user_id` cascades, so deleting the
 * member who administers a household used to take the household, and
 * everybody else's place in it, along with them.
 */
import type { Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { submitMutation } from "../harness/trpc";
import {
  countUserRow,
  openUsersTable,
  readHousehold,
  seedHousehold,
  signUpThrowawayUser,
  userRow,
} from "./admin-users-support";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

let stack: AIE2EStack;
let page: Page;

test.beforeEach(async ({ aiStack, page: fixturePage }) => {
  stack = aiStack;
  page = fixturePage;
});

/**
 * Deliberately free of the word "admin": these names are read back out of
 * table rows whose role column is what the assertions are about.
 */
function throwaway(tag: string) {
  return {
    email: `people-${tag}@norish.test`,
    password: `people-${tag}-password-1`,
    name: `People E2E ${tag}`,
  };
}

test("lists every account with the role it holds", async () => {
  const guest = await signUpThrowawayUser(stack.baseURL, throwaway("listed"));
  const table = await openUsersTable(page);

  await expect(userRow(table, "ai-e2e-a@norish.test")).toContainText("Owner");

  const row = userRow(table, guest.email);

  await expect(row).toContainText(guest.name);
  await expect(row).toContainText("No household");
  await expect(row).not.toContainText("Admin");
  await expect(row.getByRole("button", { name: "Make admin" })).toBeEnabled();
});

test("grants and revokes admin access", async () => {
  const guest = await signUpThrowawayUser(stack.baseURL, throwaway("promoted"));
  const table = await openUsersTable(page);
  const row = userRow(table, guest.email);

  await submitMutation(page, "admin.users.setAdminStatus", async () => {
    await row.getByRole("button", { name: "Make admin" }).click();
  });
  await expect(row).toContainText("Admin");

  await submitMutation(page, "admin.users.setAdminStatus", async () => {
    await row.getByRole("button", { name: "Remove admin access" }).click();
  });
  await expect(row).not.toContainText("Admin");
});

test("offers the server owner neither a role change nor a delete", async () => {
  const table = await openUsersTable(page);
  const owner = userRow(table, "ai-e2e-a@norish.test");

  await expect(owner.getByRole("button", { name: "Remove admin access" })).toBeDisabled();
  await expect(owner.getByRole("button", { name: "Delete user" })).toBeDisabled();
});

test("deleting a household's admin hands the household to who is left", async () => {
  const leaving = await signUpThrowawayUser(stack.baseURL, throwaway("leaving"));
  const staying = await signUpThrowawayUser(stack.baseURL, throwaway("staying"));
  const householdId = await seedHousehold("People E2E Household", leaving.id, [
    leaving.id,
    staying.id,
  ]);

  const table = await openUsersTable(page);
  const row = userRow(table, leaving.email);

  await row.getByRole("button", { name: "Delete user" }).click();

  const dialog = page.getByRole("dialog");

  await expect(dialog).toContainText(leaving.name);
  await submitMutation(page, "admin.users.remove", async () => {
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  });

  await expect(userRow(table, leaving.email)).toHaveCount(0);
  expect(await countUserRow(leaving.id)).toBe(0);

  const household = await readHousehold(householdId);

  expect(household).not.toBeNull();
  expect(household!.adminUserId).toBe(staying.id);
  expect(household!.memberIds).toEqual([staying.id]);
});

test("deleting the last member of a household lets the household go", async () => {
  const alone = await signUpThrowawayUser(stack.baseURL, throwaway("alone"));
  const householdId = await seedHousehold("People E2E Solo Household", alone.id, [alone.id]);

  const table = await openUsersTable(page);
  const row = userRow(table, alone.email);

  await row.getByRole("button", { name: "Delete user" }).click();
  await submitMutation(page, "admin.users.remove", async () => {
    await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  });

  await expect(userRow(table, alone.email)).toHaveCount(0);
  expect(await readHousehold(householdId)).toBeNull();
});
