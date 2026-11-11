// The household settings tab across two readers: create, join by code, remove, leave, transfer admin.
import { randomUUID } from "node:crypto";
import type { BrowserContext, Locator, Page } from "@playwright/test";

import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { signedInContext } from "../harness/auth";
import { settingsCard as card, signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const HOUSEHOLD_SETTINGS = "/settings/household";

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

test("a household is created, joined by code, a member removed, left, and admin handed over", async ({
  browser,
  aiStack,
}) => {
  const tag = randomUUID().slice(0, 8);
  // Each user and context is recorded as it is made, so `finally` removes whatever exists.
  const users: ThrowawayUser[] = [];
  const contexts: BrowserContext[] = [];
  const signedIn = async (role: string) => {
    const user = await signUpThrowawayUser(aiStack, {
      email: `household-${role}-${tag}@norish.test`,
      password: `household-${role}-${tag}-password`,
      name: `Household ${role} ${tag}`,
    });

    users.push(user);
    const context = await signedInContext(browser, aiStack.baseURL, user);

    contexts.push(context);

    return { user, page: await context.newPage() };
  };

  try {
    const { user: admin, page: adminPage } = await signedIn("admin");
    const { user: member, page: memberPage } = await signedIn("member");

    // Creating a household shows its join code to its admin.
    await adminPage.goto(HOUSEHOLD_SETTINGS);
    await card(adminPage, "Create household").getByLabel("Household name").fill(`Household ${tag}`);
    await adminPage.getByRole("button", { name: "Create household" }).click();

    const codeField = card(adminPage, "Join code").locator("input");

    await expect(codeField).toHaveValue(/^\d{6}$/);
    const code = await codeField.inputValue();

    // The member opens the tab from the bar and joins with it; each sees the other.
    await memberPage.goto("/settings/account");
    await memberPage.getByRole("tab", { name: "Household" }).click();
    await expect(memberPage).toHaveURL(new RegExp(`${HOUSEHOLD_SETTINGS}$`));
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

    // The admin hands the role to a rejoined member; the toast names them in real text.
    await joinWithCode(memberPage, code);
    await expect(memberRow(adminPage, member.name)).toBeVisible();
    await memberRow(adminPage, member.name).getByRole("button", { name: "Make admin" }).click();
    await adminPage.getByRole("dialog").getByRole("button", { name: "Transfer admin" }).click();
    await expect(adminPage.getByText(`Transferred admin to ${member.name}`)).toBeVisible();
    await expect(memberRow(memberPage, member.name)).toContainText("Admin");
    await expect(
      memberRow(memberPage, admin.name).getByRole("button", { name: "Kick" })
    ).toBeVisible();
  } finally {
    await closeAndDelete(contexts, users);
  }
});
