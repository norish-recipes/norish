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
  deleteCookbookByTitle,
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

type LibraryType = "all" | "recipes" | "cookbooks";

const CHIP_HEADINGS: Record<LibraryType, string> = {
  all: "Your library",
  recipes: "Your recipes",
  cookbooks: "Your cookbooks",
};

/** Wait for the heading to have settled on one complete string. */
async function expectHeading(text: string, timeout?: number) {
  await expect(page.locator("#recipe-library-heading")).toHaveText(text, { timeout });
}

/**
 * Light a chip, and wait until the Library has actually followed it.
 *
 * The chips are ordinary buttons on a page that hydrates behind its first
 * paint, so a click landing before React has attached is swallowed without a
 * trace — the chip is visible, enabled and stable either way, so there is
 * nothing for the click itself to fail on. The heading is the shortest honest
 * proof the click was heard, so the click is repeated until it says so.
 */
async function selectChip(name: LibraryType) {
  await expect(async () => {
    await page.locator(`[data-library-type="${name}"]`).click();
    await expectHeading(CHIP_HEADINGS[name], 5_000);
  }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });
}

/** The panel's own close control, rather than a keypress. */
async function closePanel() {
  await page.getByRole("button", { name: "Close panel" }).click();
}

/**
 * Open the membership panel from a recipe's quick actions.
 *
 * The recipe page's cookbooks card only appears once the recipe is in a
 * cookbook, so the quick actions are the door that is always there.
 */
async function openMembershipPanel() {
  await page.getByRole("button", { name: "Actions", exact: true }).first().click();
  await page.getByRole("button", { name: "Cookbooks", exact: true }).click();
}

/**
 * Put the recipe in the cookbook, from wherever the last test left it.
 *
 * The toggle says which way it is pointing, so a step that only needs the
 * recipe filed does not depend on the test before it having left it unfiled.
 */
async function ensureFiled() {
  await openMembershipPanel();

  const toggle = page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`);

  await toggle.waitFor();
  if ((await toggle.getAttribute("aria-pressed")) === "true") {
    await closePanel();

    return;
  }

  await toggle.click();
  await saveMembership();
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

  await selectChip("cookbooks");
  await expectHeading("Your cookbooks");
  // No cookbooks yet, so the recipe is gone and the empty state explains why.
  await expect(page.locator("[data-recipe-card]")).toHaveCount(0);
  await expect(page.getByText("No cookbooks yet")).toBeVisible();

  await selectChip("recipes");
  await expectHeading("Your recipes");
  await expect(recipeCard()).toBeVisible();

  await selectChip("all");
  await expectHeading("Your library");
});

test("creating a cookbook from the Library leaves the reader on the Library", async () => {
  await page.goto("/");
  await selectChip("cookbooks");

  await page.getByTestId("add-cookbook-button").click();
  await page.getByTestId("cookbook-title-input").fill(COOKBOOK_TITLE);
  await page.getByRole("button", { name: /create/i }).click();

  // Made and left in the list, not opened: the reader was reading the
  // Library, and the new cookbook appears in it.
  await expect(page).toHaveURL(/\/$/);
  await expect(cookbookCard(COOKBOOK_TITLE)).toBeVisible();
  expect(await readCookbookTitles()).toContain(COOKBOOK_TITLE);
});

test("the Add button under All makes either kind", async () => {
  const SECOND = "Sunday Roasts";

  await page.goto("/");
  await selectChip("all");

  // Both kinds are on screen, so the button is a plain Add and the menu holds
  // both — rather than an "Add Recipe" that can only make half the list.
  await expect(page.getByTestId("add-library-button")).toHaveText("Add");
  await page.getByTestId("add-library-button").click();
  await page.getByRole("menuitem", { name: "Cookbook", exact: true }).click();

  await page.getByTestId("cookbook-title-input").fill(SECOND);
  await page.getByRole("button", { name: /^create$/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(cookbookCard(SECOND)).toBeVisible();
  expect(await readCookbookTitles()).toContain(SECOND);

  // Under Recipes the button only makes recipes, because that is all the list
  // can show.
  await selectChip("recipes");
  await expect(page.getByTestId("add-library-button")).toHaveText("Add Recipe");
  await page.getByTestId("add-library-button").click();
  await expect(page.getByRole("menuitem", { name: "Cookbook", exact: true })).toHaveCount(0);

  // Leave the Library as this scenario found it: the interleaving test after
  // it is about one cookbook standing beside one recipe.
  await deleteCookbookByTitle(SECOND);
});

test("a cookbook and a recipe appear interleaved under All", async () => {
  await page.goto("/");
  await selectChip("all");

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

  // Nothing is said about cookbooks yet, because the recipe is in none.
  await expect(page.getByTestId("cookbooks-card")).toHaveCount(0);

  await openMembershipPanel();

  // Toggling stages the change; nothing is written until Save.
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);

  await saveMembership();

  // Now there is a fact to state, so the card appears with the cookbook on it.
  const card = page.getByTestId("cookbooks-card").first();

  await expect(card.locator(`[data-cookbook-chip="${COOKBOOK_TITLE}"]`)).toBeVisible();
  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });
});

test("the cookbook page lists the member it was given", async () => {
  await page.goto("/");
  await selectChip("cookbooks");
  await cookbookCard(COOKBOOK_TITLE).click();

  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();
  await expect(recipeCard()).toBeVisible();
});

test("the way back names where the reader actually came from", async () => {
  // From the Library, under the lens that is lit.
  await page.goto("/");
  await selectChip("recipes");
  await recipeCard().click();
  await expect(page.getByRole("heading", { name: RECIPE_NAME })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to recipes" }).first()).toBeVisible();

  // From inside a cookbook, the cookbook — not "recipes", which is where the
  // link used to offer to take a reader who had never been there.
  await page.goto("/");
  await selectChip("cookbooks");
  await cookbookCard(COOKBOOK_TITLE).click();
  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();
  // The cookbook itself came from the Library under Cookbooks.
  await expect(page.getByRole("link", { name: "Back to cookbooks" })).toBeVisible();

  await recipeCard().click();
  await expect(page.getByRole("heading", { name: RECIPE_NAME })).toBeVisible();

  const back = page.getByRole("link", { name: `Back to ${COOKBOOK_TITLE}` }).first();

  await expect(back).toBeVisible();
  await back.click();
  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();
});

test("the same panel takes the recipe out again", async () => {
  await page.goto("/");
  await recipeCard().click();

  // Both recipe page layouts are in the DOM; the desktop one comes first.
  const card = page.getByTestId("cookbooks-card").first();

  await card.getByTestId("file-into-cookbook").click();
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  await saveMembership();

  // The recipe is in nothing again, so the card goes with the last chip.
  await expect(page.getByTestId("cookbooks-card")).toHaveCount(0);

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);
  }).toPass({ timeout: 10_000 });
});

test("closing the membership panel without saving changes nothing", async () => {
  await page.goto("/");
  await recipeCard().click();

  await openMembershipPanel();
  await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).click();
  await closePanel();

  await expect(page.getByTestId("cookbooks-card")).toHaveCount(0);
  expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);
});

test("a cookbook fills itself from its own side", async () => {
  // The other direction: the thought starts at the cookbook, and several
  // recipes go in at once rather than one recipe at a time from each page.
  await page.goto("/");
  await selectChip("cookbooks");
  await cookbookCard(COOKBOOK_TITLE).click();
  await expect(page.getByRole("heading", { name: COOKBOOK_TITLE })).toBeVisible();

  await page.getByRole("button", { name: "Cookbook options", exact: true }).click();
  await page.getByRole("button", { name: "Add recipes", exact: true }).click();
  await page.locator(`[data-add-recipe="${RECIPE_NAME}"]`).click();

  // Staged, like every other cookbook panel.
  expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([]);

  await page.getByTestId("save-cookbook-recipes").click();

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });
});

test("the edit panel takes a recipe out of the cookbook it is editing", async () => {
  // Put it back first, so there is something to take out.
  await page.goto("/");
  await recipeCard().click();
  await ensureFiled();

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });

  await page.goto("/");
  await selectChip("cookbooks");
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
  await ensureFiled();

  await expect(async () => {
    expect(await readCookbookMembers(COOKBOOK_TITLE)).toEqual([RECIPE_NAME]);
  }).toPass({ timeout: 10_000 });

  await page.goto("/");
  await selectChip("cookbooks");
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
  await selectChip("all");
  await expect(recipeCard()).toBeVisible();
});
