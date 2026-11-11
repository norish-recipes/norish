// The household settings tab across two readers: create, join by code, remove a member, leave.
import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";

import { deleteHousehold, getHouseholdForUser } from "@norish/db/repositories/households";
import { deleteUser } from "@norish/db/repositories/users";

import type { ThrowawayUser } from "./admin-users-support";
import { signIn } from "../harness/auth";
import { signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const HOUSEHOLD_SETTINGS = "/settings/household";

function card(page: Page, title: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

function memberRow(page: Page, name: string): Locator {
  return card(page, "Members").getByRole("row").filter({ hasText: name });
}

async function joinWithCode(page: Page, code: string): Promise<void> {
  const join = card(page, "Join household");

  await join.locator("input").first().click();
  await page.keyboard.type(code);
  await join.getByRole("button", { name: "Join household" }).click();
}

async function expectNoHousehold(page: Page): Promise<void> {
  await expect(card(page, "Create household")).toBeVisible();
  await expect(card(page, "Join household")).toBeVisible();
}

test("a household is created, joined by code, a member removed, and left", async ({
  browser,
  aiStack,
}) => {
  const tag = randomUUID().slice(0, 8);
  const throwaway = (role: string) =>
    signUpThrowawayUser(aiStack, {
      email: `household-${role}-${tag}@norish.test`,
      password: `household-${role}-${tag}-password`,
      name: `Household ${role} ${tag}`,
    });
  const admin = await throwaway("admin");
  const member = await throwaway("member");
  const signedIn = async (user: ThrowawayUser) =>
    browser.newContext({
      baseURL: aiStack.baseURL,
      storageState: { cookies: await signIn(aiStack.baseURL, user), origins: [] },
    });
  const adminContext = await signedIn(admin);
  const memberContext = await signedIn(member);

  try {
    const adminPage = await adminContext.newPage();
    const memberPage = await memberContext.newPage();

    // Creating a household shows its join code to its admin.
    await adminPage.goto(HOUSEHOLD_SETTINGS);
    await card(adminPage, "Create household").getByLabel("Household name").fill(`Household ${tag}`);
    await adminPage.getByRole("button", { name: "Create household" }).click();

    const codeField = card(adminPage, "Join code").locator("input");

    await expect(codeField).toHaveValue(/^\d{6}$/);
    const code = await codeField.inputValue();

    // The member joins with it, and each sees the other in the members card.
    await memberPage.goto(HOUSEHOLD_SETTINGS);
    await joinWithCode(memberPage, code);
    await expect(memberRow(memberPage, admin.name)).toBeVisible();
    await expect(memberRow(memberPage, member.name)).toBeVisible();
    await expect(memberRow(adminPage, member.name)).toBeVisible();

    // The admin removes the member, who is left with no household.
    await memberRow(adminPage, member.name).getByRole("button", { name: "Kick" }).click();
    await adminPage.getByRole("dialog").getByRole("button", { name: "Kick user" }).click();
    await expect(memberRow(adminPage, member.name)).toBeHidden();
    await expectNoHousehold(memberPage);

    // A member who leaves sees the no-household view, and the admin loses them.
    await joinWithCode(memberPage, code);
    await expect(memberRow(memberPage, admin.name)).toBeVisible();
    await expect(memberRow(adminPage, member.name)).toBeVisible();
    await memberPage.getByRole("button", { name: "Leave household" }).click();
    await memberPage.getByRole("dialog").getByRole("button", { name: "Leave household" }).click();
    await expectNoHousehold(memberPage);
    await expect(memberRow(adminPage, member.name)).toBeHidden();
  } finally {
    await Promise.all([adminContext.close(), memberContext.close()]);

    for (const user of [admin, member]) {
      const household = await getHouseholdForUser(user.id);

      if (household) await deleteHousehold(household.id);
      await deleteUser(user.id);
    }
  }
});
