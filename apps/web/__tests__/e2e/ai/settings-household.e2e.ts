// The household settings tab across two readers: a household of one, joined by code, a member
// removed, left, and admin handed over. Every account is always in exactly one household.
import { randomUUID } from "node:crypto";
import type { BrowserContext, Locator, Page } from "@playwright/test";

import type { SessionCookies } from "../harness/auth";
import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { settingsCard as card, joinWithCode, signedInContext, signIn } from "../harness/auth";
import { callTrpc } from "../harness/trpc";
import { signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const HOUSEHOLD_SETTINGS = "/settings/household";

function memberRow(page: Page, name: string): Locator {
  return card(page, "Members").getByRole("row").filter({ hasText: name });
}

/** The reader's household is just them: its own card, no members list, and a way to join another. */
async function expectHouseholdOfOne(page: Page): Promise<void> {
  await expect(page.getByText("Your household (just you)")).toBeVisible();
  await expect(card(page, "Join household")).toBeVisible();
  await expect(card(page, "Members")).toBeHidden();
  await expect(page.getByRole("button", { name: "Leave household" })).toBeHidden();
}

async function householdIdOf(baseURL: string, cookies: SessionCookies): Promise<string> {
  const { household } = await callTrpc<{ household: { id: string } }>(
    baseURL,
    cookies,
    "households.get"
  );

  return household.id;
}

test("a new account is a household of one, joined by code, removed into a new one, left, and admin handed over", async ({
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

    return {
      user,
      page: await context.newPage(),
      cookies: await signIn(aiStack.baseURL, user),
    };
  };

  try {
    const { user: admin, page: adminPage } = await signedIn("admin");
    const { user: member, page: memberPage, cookies: memberCookies } = await signedIn("member");

    // A new account lands in a household of one, whose admin can show its join code.
    await adminPage.goto(HOUSEHOLD_SETTINGS);
    await expectHouseholdOfOne(adminPage);
    await card(adminPage, "Join code").getByRole("button", { name: "Generate join code" }).click();

    const codeField = card(adminPage, "Join code").locator("input");

    await expect(codeField).toHaveValue(/^\d{6}$/);
    const code = await codeField.inputValue();

    // The member opens the tab from the bar, sees their own household of one, and joins.
    await memberPage.goto("/settings/account");
    await memberPage.getByRole("tab", { name: "Household" }).click();
    await expect(memberPage).toHaveURL(new RegExp(`${HOUSEHOLD_SETTINGS}$`));
    await expectHouseholdOfOne(memberPage);

    const ownHousehold = await householdIdOf(aiStack.baseURL, memberCookies);

    await joinWithCode(memberPage, code);
    await expect(memberRow(memberPage, admin.name)).toBeVisible();
    await expect(memberRow(memberPage, member.name)).toBeVisible();
    await expect(memberRow(adminPage, member.name)).toBeVisible();

    const shared = await householdIdOf(aiStack.baseURL, memberCookies);

    expect(shared).not.toBe(ownHousehold);

    // The admin removes the member, who lands in a new household of one of their own.
    await memberRow(adminPage, member.name).getByRole("button", { name: "Kick" }).click();
    await adminPage.getByRole("dialog").getByRole("button", { name: "Kick user" }).click();
    await expect(memberRow(adminPage, member.name)).toBeHidden();
    await expectHouseholdOfOne(memberPage);

    const afterRemoval = await householdIdOf(aiStack.baseURL, memberCookies);

    expect(afterRemoval).not.toBe(shared);
    expect(afterRemoval).not.toBe(ownHousehold);

    // A member who leaves lands in a household of one too, and the admin loses them.
    await joinWithCode(memberPage, code);
    await expect(memberRow(memberPage, admin.name)).toBeVisible();
    await expect(memberRow(adminPage, member.name)).toBeVisible();
    await memberPage.getByRole("button", { name: "Leave household" }).click();
    await memberPage.getByRole("dialog").getByRole("button", { name: "Leave household" }).click();
    await expectHouseholdOfOne(memberPage);
    await expect(memberRow(adminPage, member.name)).toBeHidden();
    expect(await householdIdOf(aiStack.baseURL, memberCookies)).not.toBe(shared);

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
