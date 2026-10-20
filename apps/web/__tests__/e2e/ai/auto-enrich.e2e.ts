import { readProfilePreferences } from "../harness/device-preferences";
import { callTrpc, submitMutation } from "../harness/trpc";
import { withDatabase } from "./database";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await withDatabase((database) =>
    database.query(`update "user" set preferences = preferences - 'autoEnrichOnAdd'`)
  );
});

test("the settings switch saves the choice for new adds", async ({ aiStack, page }) => {
  await page.goto("/settings?tab=user");

  const control = page.getByRole("main").getByRole("switch", { name: "Enhanced" });

  await expect(control).toBeChecked();

  await submitMutation(page, "user.updatePreferences", () => control.click());

  await expect(control).not.toBeChecked();
  await expect
    .poll(
      async () =>
        (await readProfilePreferences(aiStack.baseURL, aiStack.ownerCookies)).autoEnrichOnAdd
    )
    .toBe(false);
});

test("the add dialog starts from the choice and sends its own", async ({ aiStack, page }) => {
  const { user } = await callTrpc<{ user: { version: number } }>(
    aiStack.baseURL,
    aiStack.ownerCookies,
    "user.get"
  );

  await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "user.updatePreferences", {
    version: user.version,
    preferences: { autoEnrichOnAdd: false },
  });

  await page.goto("/");
  await page.getByTestId("add-library-button").click();
  await page.getByRole("menuitem", { name: "Paste" }).click();

  const toggle = page.getByRole("dialog").getByRole("switch", { name: "Enhanced" });

  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();

  await page
    .getByPlaceholder("Paste a recipe (free text) or JSON-LD here...")
    .fill("Toast\n- 2 slices of bread\n- Toast the bread.");

  const request = page.waitForRequest(
    (candidate) =>
      candidate.method() === "POST" &&
      new URL(candidate.url()).pathname === "/api/trpc/recipes.importFromPaste"
  );

  await page.getByRole("button", { name: "AI Import" }).click();

  expect(JSON.stringify((await request).postDataJSON())).toContain('"autoEnrich":true');
});
