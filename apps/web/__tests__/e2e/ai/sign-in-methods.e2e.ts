// A password user connects OIDC under another email in Settings, signs in with it
// to the same account, and disconnects it again; and changes their password there.
import { signIn } from "../harness/auth";
import { signUpThrowawayUser } from "./admin-users-support";
import { expect, IDP_NAME, MEMBER, test } from "./fixture";

test("a password user connects OIDC in Settings, signs in with it, and disconnects it", async ({
  browser,
  aiStack,
}) => {
  const passwordContext = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: await signIn(aiStack.baseURL, MEMBER), origins: [] },
  });
  const oidcContext = await browser.newContext({ baseURL: aiStack.baseURL });

  try {
    const page = await passwordContext.newPage();
    const connect = page.getByRole("button", { name: `Connect ${IDP_NAME}` });
    const oidcRow = page.getByRole("listitem").filter({ hasText: IDP_NAME });

    // The server renders the card with its methods, so it never offers a Connect it takes back.
    const html = await (await page.goto("/settings"))?.text();

    expect(html).toContain(">Password</p>");
    expect(html).toContain(`Connect ${IDP_NAME}`);
    await expect(page.getByRole("listitem").filter({ hasText: "Password" })).toBeVisible();

    // Cancelling at the identity provider comes back with nothing added.
    aiStack.idp.signInAs = null;
    await Promise.all([page.waitForURL(/error=access_denied/), connect.click()]);
    await expect(page).toHaveURL(/\/settings$/);
    await expect(connect).toBeVisible();

    aiStack.idp.signInAs = { sub: "member-sub", email: "member@home.lan", name: "Member" };
    await connect.click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(oidcRow.getByRole("button", { name: "Disconnect" })).toBeVisible();

    const oidcPage = await oidcContext.newPage();

    await oidcPage.goto("/login");
    await oidcPage.getByRole("button", { name: `Sign in with ${IDP_NAME}` }).click();
    await expect(oidcPage).toHaveURL(/\/$/);

    const session = await (await oidcPage.request.get("/api/auth/get-session")).json();

    expect(session.user.email).toBe(MEMBER.email);

    await oidcPage.goto("/settings");
    await oidcPage
      .getByRole("listitem")
      .filter({ hasText: IDP_NAME })
      .getByRole("button", { name: "Disconnect" })
      .click();
    await expect(oidcPage.getByRole("button", { name: `Connect ${IDP_NAME}` })).toBeVisible();
  } finally {
    aiStack.idp.signInAs = null;
    await Promise.all([passwordContext.close(), oidcContext.close()]);
  }
});

test("a password user changes their password in Settings and signs out their other sessions", async ({
  browser,
  aiStack,
}) => {
  const user = await signUpThrowawayUser(aiStack, {
    email: "change-password@norish.test",
    name: "Change password",
    password: "original-password",
  });
  const context = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: await signIn(aiStack.baseURL, user), origins: [] },
  });
  const other = await browser.newContext({
    baseURL: aiStack.baseURL,
    storageState: { cookies: await signIn(aiStack.baseURL, user), origins: [] },
  });

  try {
    const page = await context.newPage();

    await page.goto("/settings");
    await page
      .getByRole("listitem")
      .filter({ hasText: "Password" })
      .getByRole("button", { name: "Change password" })
      .click();

    const dialog = page.getByRole("dialog");
    const current = dialog.getByLabel("Current password", { exact: true });
    const submit = dialog.getByRole("button", { name: "Change password" });

    await current.fill("wrong-password");
    await dialog.getByLabel("New password", { exact: true }).fill("replacement-password");
    await dialog.getByLabel("Confirm new password", { exact: true }).fill("different-password");
    await expect(dialog).toContainText("Passwords do not match");
    await expect(submit).toBeDisabled();

    await dialog.getByLabel("Confirm new password", { exact: true }).fill("replacement-password");
    await submit.click();
    await expect(dialog).toContainText("The current password is incorrect.");

    await current.fill(user.password);
    await submit.click();
    await expect(page.getByText("Password changed.")).toBeVisible();
    await expect(dialog).toBeHidden();

    // This session goes on; the other one is signed out, and only the new password signs in.
    expect(await (await page.request.get("/api/auth/get-session")).json()).not.toBeNull();
    expect(await (await other.request.get("/api/auth/get-session")).json()).toBeNull();
    await expect(signIn(aiStack.baseURL, user)).rejects.toThrow();
    await signIn(aiStack.baseURL, { ...user, password: "replacement-password" });
  } finally {
    await Promise.all([context.close(), other.close()]);
  }
});
