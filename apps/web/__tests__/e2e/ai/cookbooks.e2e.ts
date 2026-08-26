/**
 * Cookbooks, end to end in a real browser against the production-like stack.
 *
 * These are the acceptance criteria that only browser behaviour can settle:
 * the three chips changing both the list and the heading, both kinds appearing
 * in one interleaved list, creating a cookbook from the Library, filing a
 * recipe from its quick actions and seeing it on the recipe page card,
 * removing it again from the same panel, opening the cookbook page and finding
 * the member, and renaming then deleting a cookbook without disturbing its
 * recipes.
 */
import type { Page } from "@playwright/test";

import {
  clearCookbooks,
  readCookbookMembers,
  readCookbookTitles,
  recipeExists,
  seedRecipe,
} from "./cookbooks-support";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const RECIPE_NAME = "Cookbook Scenario Stew";
const COOKBOOK_TITLE = "Weeknight Dinners";
const RENAMED_TITLE = "Weeknight Favourites";

let page: Page;

async function chip(name: "all" | "recipes" | "cookbooks") {
  return page.locator(`[data-library-type="${name}"]`);
}

/** Wait for the heading to have settled on one complete string. */
async function expectHeading(text: string) {
  await expect(page.locator("#recipe-library-heading")).toHaveText(text);
}

/** The panel's own close control, rather than a keypress. */
async function closePanel() {
  await page.getByRole("button", { name: "Close panel" }).click();
}

/** Commit the membership panel, which never writes until it is saved. */
async function saveMembership() {
  await page.getByTestId("save-cookbook-membership").click();
}

/**
 * Rows by kind rather than by text.
 *
 * A cookbook's card is described by the names of the recipes inside it, so a
 * bare text match on a recipe's name finds the cookbook holding it as well as
 * the recipe itself — and under the default sort the cookbook comes first.
 */
function recipeCard() {
  return page.locator("[data-recipe-card]").filter({ hasText: RECIPE_NAME }).first();
}

function cookbookCard(title: string) {
  return page.locator("[data-cookbook-card]").filter({ hasText: title }).first();
}

test.beforeAll(async ({ aiStack: _aiStack }) => {
  await clearCookbooks();
  await seedRecipe(RECIPE_NAME);
});

test.beforeEach(async ({ page: fixturePage }) => {
  page = fixturePage;
});

test("the three chips change both the list and the heading", async () => {
  await page.goto("/");

  await expectHeading("Your library");
  await expect(recipeCard()).toBeVisible();

  await (await chip("cookbooks")).click();
  await expectHeading("Your cookbooks");
  // No cookbooks yet, so the recipe is gone and the empty state explains why.
  await expect(page.locator("[data-recipe-card]")).toHaveCount(0);
  await expect(page.getByText("No cookbooks yet")).toBeVisible();

  await (await chip("recipes")).click();
  await expectHeading("Your recipes");
  await expect(recipeCard()).toBeVisible();

  await (await chip("all")).click();
  await expectHeading("Your library");
});

test("creating a cookbook from the Library leaves the reader on the Library", async () => {
  await page.goto("/");
  await (await chip("cookbooks")).click();

  await page.getByTestId("add-cookbook-button").click();
  await page.getByTestId("cookbook-title-input").fill(COOKBOOK_TITLE);
  await page.getByRole("button", { name: /create/i }).click();

  // Made and left in the list, not opened: the reader was reading the
  // Library, and the new cookbook appears in it.
  await expect(page).toHaveURL(/\/$/);
  await expect(cookbookCard(COOKBOOK_TITLE)).toBeVisible();
  expect(await readCookbookTitles()).toContain(COOKBOOK_TITLE);
});

test("a cookbook and a recipe appear interleaved under All", async () => {
  await page.goto("/");
  await (await chip("all")).click();

  // Newest first by default, so the cookbook made second leads and the recipe
  // follows it — one list ordered by the reader's sort, not two bands.
  const cards = page.locator("[data-cookbook-card], [data-recipe-card]");

  // Both kinds are on screen — wait for the real cards, since the skeleton
  // carries the recipe-card marker too.
  await expect(cookbookCard(COOKBOOK_TITLE)).toBeVisible();
  await expect(recipeCard()).toBeVisible();

  const kinds = await cards.evaluateAll((nodes) =>
    nodes.map((node) => (node.hasAttribute("data-cookbook-card") ? "cookbook" : "recipe"))
  );

  // Newest first, so the cookbook made second leads and the recipe follows.
  expect(kinds.slice(0, 2)).toEqual(["cookbook", "recipe"]);
});

test("filing a recipe from its quick actions shows it on the recipe page card", async () => {
  await page.goto("/");
  await recipeCard().click();
  await expect(page.getByRole("heading", { name: RECIPE_NAME })).toBeVisible();

  // The card starts as an invitation, because the recipe is in no cookbook.
  // Both recipe page layouts are in the DOM; the desktop one comes first.
  const card = page.getByTestId("cookbooks-card").first();

  await expect(card).toBeVisible();
  await card.getByTestId("file-into-cookbook").click();

  // Toggling stages the change; nothing is written until Save.
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);

  await saveMembership();

  await expect(card.locator(`[data-cookbook-chip="${COOKBOOK_TITLE}"]`)).toBeVisible();
  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });
});

test("the cookbook page lists the member it was given", async () => {
  await page.goto("/");
  await (await chip("cookbooks")).click();
  await cookbookCard(COOKBOOK_TITLE).click();

  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();
  await expect(recipeCard()).toBeVisible();
});

test("the same panel takes the recipe out again", async () => {
  await page.goto("/");
  await recipeCard().click();

  // Both recipe page layouts are in the DOM; the desktop one comes first.
  const card = page.getByTestId("cookbooks-card").first();

  await card.getByTestId("file-into-cookbook").click();
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  await saveMembership();

  await expect(card.locator(`[data-cookbook-chip="${COOKBOOK_TITLE}"]`)).toHaveCount(0);

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);
  }).toPass({ timeout: 10_000 });
});

test("closing the membership panel without saving changes nothing", async () => {
  await page.goto("/");
  await recipeCard().click();

  // Both recipe page layouts are in the DOM; the desktop one comes first.
  const card = page.getByTestId("cookbooks-card").first();

  await card.getByTestId("file-into-cookbook").click();
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  await closePanel();

  await expect(card.locator(`[data-cookbook-chip="${COOKBOOK_TITLE}"]`)).toHaveCount(0);
  expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);
});

test("the edit panel takes a recipe out of the cookbook it is editing", async () => {
  // Put it back first, so there is something to take out.
  await page.goto("/");
  await recipeCard().click();
  await page.getByTestId("cookbooks-card").first().getByTestId("file-into-cookbook").click();
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  await saveMembership();

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });

  await page.goto("/");
  await (await chip("cookbooks")).click();
  await cookbookCard(COOKBOOK_TITLE).click();
  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();

  await page.getByRole("button", { name: "Cookbook options", exact: true }).click();
  await page.getByRole("button", { name: "Edit cookbook", exact: true }).click();
  await page.locator(`[data-remove-member="${RECIPE_NAME}"]`).click();

  // Staged, like everything else in this panel: nothing is written yet.
  expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);

  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);
  }).toPass({ timeout: 10_000 });
  // Unfiling is never destructive.
  expect(await recipeExists(RECIPE_NAME)).toBe(true);
});

test("renaming and deleting a cookbook leaves its recipes alone", async () => {
  // Put the recipe back, so the delete has something to not destroy.
  await page.goto("/");
  await recipeCard().click();
  await page.getByTestId("cookbooks-card").first().getByTestId("file-into-cookbook").click();
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  await saveMembership();

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });

  await page.goto("/");
  await (await chip("cookbooks")).click();
  await cookbookCard(COOKBOOK_TITLE).click();

  // Wait for the cookbook's own page: the Library card carrying the same
  // action labels is gone by then.
  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();

  // Rename from inside the cookbook, through the same panel that takes
  // recipes out of it.
  await page.getByRole("button", { name: "Cookbook options", exact: true }).click();
  await page.getByRole("button", { name: "Edit cookbook", exact: true }).click();
  await page.getByTestId("cookbook-title-input").fill(RENAMED_TITLE);
  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(page.getByRole("heading", { name: RENAMED_TITLE })).toBeVisible();
  await expect(async () => {
    expect(await readCookbookTitles()).toContain(RENAMED_TITLE);
  }).toPass({ timeout: 10_000 });

  // Delete, confirmed by name.
  await page.getByRole("button", { name: "Cookbook options", exact: true }).click();
  await page.getByRole("button", { name: "Delete cookbook", exact: true }).click();
  await page.getByTestId("confirm-delete-cookbook").click();

  await expect(async () => {
    expect(await readCookbookTitles()).not.toContain(RENAMED_TITLE);
  }).toPass({ timeout: 10_000 });

  // Organising is never destructive: the recipe it held is untouched.
  expect(await recipeExists(RECIPE_NAME)).toBe(true);
  await page.goto("/");
  // The chip choice persisted, so come back to All to see the recipe again.
  await (await chip("all")).click();
  await expect(recipeCard()).toBeVisible();
});
