// The account settings cards a reader edits: API keys, site tokens, allergies and the Avatar.
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";

import type { ThrowawayUser } from "./admin-users-support";
import { closeAndDelete } from "../harness/accounts";
import { signedInContext } from "../harness/auth";
import { callTrpc } from "../harness/trpc";
import { settingsCard as card, signUpThrowawayUser } from "./admin-users-support";
import { expect, test } from "./fixture";

const ACCOUNT_SETTINGS = "/settings/account";
const PHOTO = path.join(import.meta.dirname, "fixtures", "supplied-photo.jpg");

test("a reader manages API keys, site tokens, allergies and their Avatar", async ({
  browser,
  aiStack,
}) => {
  const tag = randomUUID().slice(0, 8);
  // Each user and context is recorded as it is made, so `finally` removes whatever exists.
  const users: ThrowawayUser[] = [];
  const contexts: BrowserContext[] = [];

  try {
    const user = await signUpThrowawayUser(aiStack, {
      email: `account-${tag}@norish.test`,
      password: `account-${tag}-password`,
      name: `Account ${tag}`,
    });

    users.push(user);
    const context = await signedInContext(browser, aiStack.baseURL, user);

    contexts.push(context);
    const cookies = await context.cookies();
    const page = await context.newPage();

    await page.goto(ACCOUNT_SETTINGS);

    // An API key is created, listed and deleted.
    const apiKeys = card(page, "API keys");
    const keyName = `E2E key ${tag}`;

    await apiKeys.getByLabel("Key name (optional)").fill(keyName);
    await apiKeys.getByRole("button", { name: "Create key" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "I've saved it" }).click();

    const keyRow = apiKeys.getByRole("row").filter({ hasText: keyName });

    await expect(keyRow).toBeVisible();
    await keyRow.getByRole("button", { name: "Delete key" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete key" }).click();
    await expect(keyRow).toBeHidden();
    await expect(apiKeys).toContainText("No API keys yet");

    // A site token is added and removed.
    const tokens = card(page, "Site authentication tokens");

    await tokens.getByLabel("Domain").fill("example.com");
    await tokens.getByLabel("Name", { exact: true }).fill("Cookie");
    await tokens.getByLabel("Value").fill(`secret-${tag}`);
    await tokens.getByRole("button", { name: "Add token" }).click();

    const tokenRow = tokens.getByRole("row").filter({ hasText: "example.com" });

    await expect(tokenRow).toBeVisible();
    await tokenRow.getByRole("button", { name: "Delete token" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete token" }).click();
    await expect(tokenRow).toBeHidden();
    await expect(tokens).toContainText("No site authentication tokens configured.");

    // Allergies are set and still set after a reload.
    const allergies = card(page, "Allergies");

    await allergies.getByRole("textbox").pressSequentially("peanuts ");
    await expect(allergies.getByRole("button", { name: "peanuts" })).toBeVisible();
    await allergies.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(
        async () =>
          (await callTrpc<{ allergies: string[] }>(aiStack.baseURL, cookies, "user.getAllergies"))
            .allergies
      )
      .toEqual(["peanuts"]);
    await page.reload();
    await expect(card(page, "Allergies").getByRole("button", { name: "peanuts" })).toBeVisible();

    // An Avatar is uploaded and removed.
    const profile = card(page, "Profile");
    const avatar = profile.getByRole("img", { name: user.name }).locator("img");

    await profile.locator('input[type="file"]').setInputFiles(PHOTO);
    await profile.getByRole("button", { name: "Save" }).click();
    await expect(avatar).toHaveAttribute("src", /\/avatars\//);
    await page.reload();
    await expect(avatar).toHaveAttribute("src", /\/avatars\//);
    await profile.getByRole("button", { name: "Delete profile picture" }).click();
    await expect(avatar).toBeHidden();
    await page.reload();
    await expect(profile.getByRole("img", { name: user.name })).toBeVisible();
    await expect(avatar).toBeHidden();
  } finally {
    await closeAndDelete(contexts, users);
  }
});
