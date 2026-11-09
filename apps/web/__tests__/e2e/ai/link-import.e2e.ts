/**
 * The import page a bookmarklet or share sheet lands on: a link alone imports
 * nothing until a press, the reader's own bookmarklet code imports at once, and
 * a signed-out reader signs in and comes back to the same link.
 */
import { callTrpc, submitMutation } from "../harness/trpc";
import { expect, OWNER, test } from "./fixture";

const LINK = "https://norish-test.invalid/recipes/bookmarklet-soup";
const IMPORT_PAGE = `/import?url=${encodeURIComponent(LINK)}`;
const ASK = "Import this recipe?";

test("a link sent to the import page waits for a press, then queues", async ({ page }) => {
  await page.goto(IMPORT_PAGE);

  await expect(page.getByRole("heading", { name: ASK })).toBeVisible();
  await expect(page.getByText(LINK)).toBeVisible();

  await submitMutation(page, "recipes.importFromUrl", () =>
    page.getByRole("button", { name: "Import", exact: true }).click()
  );

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Importing recipe...")).toBeVisible();
});

test("the reader's own code imports at once", async ({ page, aiStack }) => {
  const code = await callTrpc<string>(aiStack.baseURL, aiStack.ownerCookies, "user.importLinkCode");

  await submitMutation(page, "recipes.importFromUrl", async () => {
    await page.goto(`${IMPORT_PAGE}&code=${encodeURIComponent(code)}`);
  });

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Importing recipe...")).toBeVisible();
});

test("a wrong code still waits for a press", async ({ page }) => {
  await page.goto(`${IMPORT_PAGE}&code=not-the-code`);

  await expect(page.getByRole("heading", { name: ASK })).toBeVisible();
  await expect(page).toHaveURL(/\/import\?/);
});

test("the import page has nothing to offer without a link", async ({ page }) => {
  await page.goto("/import");

  await expect(
    page.getByRole("heading", { name: "There's no recipe link to import" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeHidden();
});

test("a signed-out reader signs in and comes back to the link", async ({ browser, aiStack }) => {
  const context = await browser.newContext({ baseURL: aiStack.baseURL });
  const page = await context.newPage();

  try {
    await page.goto(IMPORT_PAGE);
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("heading", { name: ASK })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(LINK)).toBeVisible();
  } finally {
    await context.close();
  }
});
