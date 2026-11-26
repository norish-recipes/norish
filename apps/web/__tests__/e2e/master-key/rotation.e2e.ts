/**
 * Master Key rotation in file mode (ADR-0044): an administrator rotates through the System card,
 * the restarted server re-keys and ends every session, and what was saved before still works.
 */
import { getDecryptedTokensByUserId } from "@norish/db/repositories/site-auth-tokens";
import { readKeyFile } from "@norish/shared-server/master-key";

import { userIdOf } from "../harness/accounts";
import { settingsCard, signedInContext, signIn } from "../harness/auth";
import { MASTER_KEY } from "../harness/environment";
import { waitForHydration } from "../harness/hydration";
import { createRecipe } from "../harness/recipes";
import { openBase64MasterKey } from "../harness/repositories";
import { callTrpc } from "../harness/trpc";
import { expect, MEMBER, OWNER, test } from "./fixture";

const RECIPE = "Rotation Rye Bread";
const TOKEN = { domain: "recipes.example", name: "X-Norish-E2E", value: "e2e-session" };

test("an administrator rotates the master key, signs in again, and saved tokens and shares still work", async ({
  browser,
  stack,
}) => {
  // Saved on the key the stack started with.
  const ownerCookies = await signIn(stack.baseURL, OWNER);
  const memberCookies = await signIn(stack.baseURL, MEMBER);
  const recipeId = await createRecipe(stack.baseURL, ownerCookies, RECIPE, ["500 g rye flour"]);
  const share = await callTrpc<{ url: string }>(
    stack.baseURL,
    ownerCookies,
    "recipes.shareCreate",
    {
      recipeId,
    }
  );

  await callTrpc(stack.baseURL, ownerCookies, "siteAuthTokens.create", {
    ...TOKEN,
    type: "header",
  });
  const ownerId = await userIdOf(OWNER);

  expect(await readKeyFile()).toEqual({ current: MASTER_KEY });

  const context = await signedInContext(browser, stack.baseURL, OWNER);
  const page = await context.newPage();

  try {
    await page.goto("/settings/admin");
    // Not scrolled to first: the screen swaps its cards while it loads, and a click survives that.
    await settingsCard(page, "System settings")
      .getByRole("button", { name: "Rotate master key" })
      .click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("Every session ends, yours included")).toBeVisible();
    await expect(dialog.getByText("Share links made before 0.28 stop working")).toBeVisible();

    const [answer] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("/api/trpc/admin.rotateMasterKey")
      ),
      dialog.getByRole("button", { name: "Rotate", exact: true }).click(),
    ]);
    const rotated = await readKeyFile();
    const newKey = rotated?.current ?? "";

    // On disk before the restart: a new key, and the old one kept until the boot re-keys.
    expect(rotated).toEqual({ current: expect.any(String), previous: MASTER_KEY });
    expect(newKey).not.toBe(MASTER_KEY);
    const answered = await answer.text();

    expect(answered).not.toContain(MASTER_KEY);
    expect(answered).not.toContain(newKey);

    // The action exits the server; a `restart: always` deployment starts it again.
    await stack.restartAfterExit();

    // This page's session ended with the re-key, so it goes to sign-in on its own.
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fsettings%2Fadmin/, { timeout: 90_000 });
    await expect(page.getByLabel("Email")).toBeVisible();
    // The app navigated here itself, so no goto waited for the form to hydrate.
    await waitForHydration(page);
    expect(await readKeyFile()).toEqual({ current: newKey });

    // Every session ended, a member's too.
    for (const cookies of [ownerCookies, memberCookies]) {
      await expect(callTrpc(stack.baseURL, cookies, "user.get")).rejects.toMatchObject({
        status: 401,
      });
    }

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/admin$/, { timeout: 15_000 });

    const signedInAgain = await context.cookies();
    const profile = await callTrpc<{ user: { name: string; email: string } }>(
      stack.baseURL,
      signedInAgain,
      "user.get"
    );

    expect(profile.user).toMatchObject({ name: OWNER.name, email: OWNER.email });
    expect(
      await callTrpc<{ domain: string; name: string }[]>(
        stack.baseURL,
        signedInAgain,
        "siteAuthTokens.list"
      )
    ).toEqual([expect.objectContaining({ domain: TOKEN.domain, name: TOKEN.name })]);
    // The import worker's own read of the token, now under the new key.
    openBase64MasterKey(newKey);
    expect((await getDecryptedTokensByUserId(ownerId)).map(({ value }) => value)).toEqual([
      TOKEN.value,
    ]);

    // Signed out, as a share link is mostly read.
    const anonymous = await browser.newContext({ baseURL: stack.baseURL });

    try {
      const shared = await anonymous.newPage();

      await shared.goto(share.url);
      await expect(shared.getByRole("heading", { name: RECIPE }).first()).toBeVisible();
    } finally {
      await anonymous.close();
    }
  } finally {
    await context.close();
  }
});
