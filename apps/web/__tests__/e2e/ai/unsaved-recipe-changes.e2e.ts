/**
 * A recipe with unsaved edits asks before it is left by a reload or the
 * Cancel button. Answering no keeps the shopper on the page with their edit.
 */
import type { Dialog, Page } from "@playwright/test";

import { seedRecipe } from "./cookbooks-support";
import { expect, test } from "./fixture";

const NAME = "Unsaved Soup";
const DISCARD = "You have unsaved changes. Discard them and leave this page?";

let page: Page;
let recipeId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ aiStack: _aiStack }) => {
  recipeId = await seedRecipe(NAME);
});

test.beforeEach(async ({ page: fixturePage }) => {
  page = fixturePage;
});

function nameField() {
  return page.getByLabel("Recipe Name");
}

/** Open the editor from the recipe page, the way a reader does, and change the name. */
async function editTheName() {
  await page.goto(`/recipes/${recipeId}`);
  await page.getByRole("button", { name: "Actions" }).first().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/recipes/edit/${recipeId}$`));
  await expect(nameField()).toHaveValue(NAME);
  // A typed edit, so the browser counts the page as interacted with: it only
  // asks before leaving a page someone has touched.
  await nameField().click();
  await nameField().pressSequentially(" draft");
}

async function answer(next: () => Promise<unknown>, accept: boolean): Promise<Dialog> {
  const asked = page.waitForEvent("dialog");

  void next().catch(() => undefined);
  const dialog = await asked;

  await (accept ? dialog.accept() : dialog.dismiss());

  return dialog;
}

async function expectStillEditing() {
  await expect(page).toHaveURL(new RegExp(`/recipes/edit/${recipeId}$`));
  await expect(nameField()).toHaveValue(`${NAME} draft`);
}

test("a reload asks before the edit is thrown away", async () => {
  await editTheName();

  const dialog = await answer(() => page.reload(), false);

  expect(dialog.type()).toBe("beforeunload");
  await expectStillEditing();
});

test("Cancel asks before the edit is thrown away", async () => {
  await editTheName();

  const dialog = await answer(() => page.getByRole("button", { name: "Cancel" }).click(), false);

  expect(dialog.message()).toBe(DISCARD);
  await expectStillEditing();
});
