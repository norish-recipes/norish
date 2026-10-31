/**
 * Selecting recipes in the Library and on a cookbook page, and acting on the
 * selection from the action bar, in a real browser against the
 * production-like stack: how selecting starts and ends, what it survives,
 * where the bar stands, and what Delete, Add to cookbook and Remove from
 * cookbook leave behind.
 */
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";

import type { AIE2EStack, SessionCookies } from "./fixture";
import { signIn } from "../harness/auth";
import { callTrpc } from "../harness/trpc";
import {
  readCookbookMembers,
  readCookbookTitles,
  recipeExists,
  seedCookbook,
  seedRecipe,
} from "./cookbooks-support";
import { expect, MEMBER, test } from "./fixture";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 1600 };

/** A run-unique word, so a search finds only this scenario's recipes. */
function token(label: string): string {
  return `${label}${Date.now().toString(36)}`;
}

async function openPage(
  browser: Browser,
  stack: AIE2EStack,
  {
    phone = false,
    cookies = stack.ownerCookies,
  }: { phone?: boolean; cookies?: SessionCookies } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies, origins: [] },
    viewport: phone ? PHONE : DESKTOP,
    hasTouch: phone,
  });

  return { context, page: await context.newPage() };
}

function card(page: Page, name: string): Locator {
  return page.locator("[data-recipe-card]").filter({ hasText: name }).first();
}

function bar(page: Page): Locator {
  return page.getByRole("toolbar", { name: "Selected recipes" });
}

async function expectCount(page: Page, count: number) {
  await expect(page.getByTestId("selection-count")).toHaveText(`${count} selected`);
}

/** Search the Library, waiting for the cards to follow. */
async function search(page: Page, text: string, shows: string) {
  await page.locator("#search-input").fill(text);
  await expect(card(page, shows)).toBeVisible();
}

/** Hold the mouse on a card until it starts selecting. */
async function longPress(page: Page, name: string) {
  await settled(page, card(page, name));
  const box = (await card(page, name).boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
}

/** The card's selection toggle, which covers it while selecting. */
function toggle(page: Page, name: string): Locator {
  return page
    .getByRole("button", { name, exact: true })
    .and(page.getByTestId("recipe-select-toggle"));
}

/**
 * Wait until a sliding button has stopped: a click retried on a moving one
 * scrolls it to the top, and a scroll closes the row it sits in.
 */
async function settled(page: Page, target: Locator) {
  let last = "";
  let still = 0;

  await expect
    .poll(async () => {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      const box = JSON.stringify(await target.boundingBox());

      still = box !== "null" && box === last ? still + 1 : 0;
      last = box;

      return still;
    })
    .toBeGreaterThanOrEqual(3);
}

/** Seed recipes, open the Library on them and wait for their cards. */
async function libraryWith(
  browser: Browser,
  stack: AIE2EStack,
  names: string[],
  options: { phone?: boolean; cookies?: SessionCookies; query: string }
): Promise<{ context: BrowserContext; page: Page; ids: string[] }> {
  const ids: string[] = [];

  for (const name of names) ids.push(await seedRecipe(name));
  const { context, page } = await openPage(browser, stack, options);

  await page.goto("/");
  await search(page, options.query, names[0]!);
  for (const name of names.filter((entry) => entry.includes(options.query))) {
    await expect(card(page, name)).toBeVisible();
  }

  return { context, page, ids };
}

test("a long press starts selecting, and a tap then toggles without opening the recipe", async ({
  browser,
  aiStack,
}) => {
  const word = token("Press");
  const names = [`${word} Soup`, `${word} Salad`];
  const { context, page } = await libraryWith(browser, aiStack, names, { query: word });

  try {
    await longPress(page, names[0]!);
    await expect(bar(page)).toBeVisible();
    await expectCount(page, 1);

    await toggle(page, names[1]!).click();
    await expectCount(page, 2);
    await expect(page).toHaveURL(/\/$/);

    // Deselecting the last card ends selecting.
    await toggle(page, names[0]!).click();
    await toggle(page, names[1]!).click();
    await expect(bar(page)).toBeHidden();
  } finally {
    await context.close();
  }
});

test("the Select action in a card's row starts selecting, and Escape ends it", async ({
  browser,
  aiStack,
}) => {
  const word = token("Row");
  const names = [`${word} Stew`];
  const { context, page } = await libraryWith(browser, aiStack, names, { query: word });

  try {
    const select = page
      .getByRole("row")
      .filter({ has: card(page, names[0]!) })
      .getByRole("button", { name: "Select", exact: true });

    // A press before the row listens opens nothing, and a late list refresh
    // closes an open row, so open and press until the bar shows.
    await expect(async () => {
      if (await bar(page).isVisible()) return;
      if (!(await select.isVisible())) {
        await card(page, names[0]!).locator('button[aria-label="Recipe options"]').click();
      }
      await settled(page, select);
      await select.click({ timeout: 2_000 });
      await expect(bar(page)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 45_000 });
    await expectCount(page, 1);

    await page.keyboard.press("Escape");
    await expect(bar(page)).toBeHidden();
  } finally {
    await context.close();
  }
});

test("Cmd-click toggles a card and Shift-click selects a range, skipping nothing loaded", async ({
  browser,
  aiStack,
}) => {
  const word = token("Range");
  // Seeded oldest first, so newest-first shows them in reverse.
  const names = [`${word} Delta`, `${word} Gamma`, `${word} Beta`, `${word} Alpha`];
  const { context, page } = await libraryWith(browser, aiStack, names, { query: word });

  try {
    await card(page, `${word} Alpha`).click({ modifiers: ["ControlOrMeta"] });
    await expectCount(page, 1);
    await expect(page).toHaveURL(/\/$/);

    await toggle(page, `${word} Delta`).click({ modifiers: ["Shift"] });
    await expectCount(page, 4);

    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(bar(page)).toBeHidden();
  } finally {
    await context.close();
  }
});

test("the selection survives a search change, and the count includes what it hides", async ({
  browser,
  aiStack,
}) => {
  const pasta = `${token("Keepa")} Pasta`;
  const pizza = `${token("Keepi")} Pizza`;
  const { context, page } = await libraryWith(browser, aiStack, [pasta, pizza], {
    query: pasta,
  });

  try {
    await card(page, pasta).click({ modifiers: ["ControlOrMeta"] });
    await search(page, pizza, pizza);
    await expect(card(page, pasta)).toBeHidden();
    await toggle(page, pizza).click();
    await expectCount(page, 2);
  } finally {
    await context.close();
  }
});

test("at phone width the bar takes the place of the bottom navigation", async ({
  browser,
  aiStack,
}) => {
  const word = token("Phone");
  const names = [`${word} Curry`];
  const { context, page } = await libraryWith(browser, aiStack, names, {
    query: word,
    phone: true,
  });

  try {
    const home = page.getByRole("link", { name: "Groceries" });

    await expect(home).toBeVisible();
    await longPress(page, names[0]!);
    await expect(bar(page)).toBeVisible();
    await expect(home).toBeHidden();

    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(home).toBeVisible();
  } finally {
    await context.close();
  }
});

test("Delete removes the selection after a confirmation naming the count", async ({
  browser,
  aiStack,
}) => {
  const word = token("Gone");
  const names = [`${word} One`, `${word} Two`];
  const { context, page } = await libraryWith(browser, aiStack, names, { query: word });

  try {
    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await toggle(page, names[1]!).click();
    await bar(page).getByRole("button", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog");

    await expect(dialog).toContainText("Delete 2 recipes?");
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(bar(page)).toBeHidden();
    for (const name of names) await expect(card(page, name)).toBeHidden();
    await expect
      .poll(async () => (await recipeExists(names[0]!)) || recipeExists(names[1]!))
      .toBe(false);
  } finally {
    await context.close();
  }
});

test("Delete says how many stay when the reader may not delete some", async ({
  browser,
  aiStack,
}) => {
  const word = token("Theirs");
  const names = [`${word} Owned`];
  const memberRecipe = `${word} Mine`;
  const memberCookies = await signIn(aiStack.baseURL, MEMBER);

  // Everyone sees every recipe; only its owner deletes it.
  await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
    view: "everyone",
    edit: "owner",
    delete: "owner",
  });
  await callTrpc(aiStack.baseURL, memberCookies, "recipes.create", {
    name: memberRecipe,
    servings: 2,
    systemUsed: "metric",
    recipeIngredients: [],
    steps: [],
    tags: [],
    cuisines: [],
    categories: [],
    images: [],
    videos: [],
  });

  const { context, page } = await libraryWith(browser, aiStack, names, {
    query: word,
    cookies: memberCookies,
  });

  try {
    await expect(card(page, memberRecipe)).toBeVisible();
    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await toggle(page, memberRecipe).click();
    await bar(page).getByRole("button", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog");

    await expect(dialog).toContainText("Delete 1 recipe?");
    await expect(dialog).toContainText("1 recipe stays, because you may not delete it.");
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(card(page, memberRecipe)).toBeHidden();
    await expect.poll(() => recipeExists(memberRecipe)).toBe(false);
    expect(await recipeExists(names[0]!)).toBe(true);
  } finally {
    await context.close();
    await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
      view: "everyone",
      edit: "household",
      delete: "household",
    });
  }
});

test("Delete is unavailable when no selected recipe may be deleted", async ({
  browser,
  aiStack,
}) => {
  const word = token("Locked");
  const names = [`${word} Owned`];
  const memberCookies = await signIn(aiStack.baseURL, MEMBER);

  await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
    view: "everyone",
    edit: "owner",
    delete: "owner",
  });

  const { context, page } = await libraryWith(browser, aiStack, names, {
    query: word,
    cookies: memberCookies,
  });

  try {
    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await expect(bar(page).getByRole("button", { name: "Delete" })).toBeDisabled();
  } finally {
    await context.close();
    await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "admin.updateRecipePermissionPolicy", {
      view: "everyone",
      edit: "household",
      delete: "household",
    });
  }
});

test("recipes picked across two searches file into a new cookbook, and Open lands on it", async ({
  browser,
  aiStack,
}) => {
  const word = token("File");
  const pasta = [`${word} Pasta Carbonara`, `${word} Pasta Pesto`];
  const pizza = [`${word} Pizza Margherita`];
  const title = `${word} Italian`;
  const { context, page } = await libraryWith(browser, aiStack, [...pasta, ...pizza], {
    query: word,
  });

  try {
    await search(page, `${word} Pasta`, pasta[0]!);
    await card(page, pasta[0]!).click({ modifiers: ["ControlOrMeta"] });
    await toggle(page, pasta[1]!).click();
    await search(page, `${word} Pizza`, pizza[0]!);
    await toggle(page, pizza[0]!).click();
    await expectCount(page, 3);

    await bar(page).getByRole("button", { name: "Add to cookbook" }).click();
    await page.getByTestId("selection-new-cookbook-title").fill(title);
    await page.getByTestId("save-selection-cookbooks").click();

    await expect(bar(page)).toBeHidden();
    const toast = page
      .locator("[data-action-toast]")
      .filter({ hasText: `3 recipes added to ${title}` });

    await toast.getByRole("button", { name: "Open" }).click();
    await expect(page.locator("#cookbook-heading")).toHaveText(title);
    for (const name of [...pasta, ...pizza]) await expect(card(page, name)).toBeVisible();
    expect(await readCookbookMembers(aiStack, title)).toEqual(
      [...pasta, ...pizza].sort((a, b) => a.localeCompare(b))
    );
  } finally {
    await context.close();
  }
});

test("filing into a cookbook that already holds one of the recipes keeps one membership", async ({
  browser,
  aiStack,
}) => {
  const word = token("Again");
  const names = [`${word} Tagine`, `${word} Couscous`];
  const title = `${word} Moroccan`;
  const { context, page, ids } = await libraryWith(browser, aiStack, names, { query: word });

  await seedCookbook(aiStack, title, [ids[0]!]);

  try {
    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await toggle(page, names[1]!).click();
    await bar(page).getByRole("button", { name: "Add to cookbook" }).click();
    await page.locator(`[data-cookbook-toggle="${title}"]`).click();
    await page.getByTestId("save-selection-cookbooks").click();

    await expect(page.locator("[data-action-toast]")).toContainText(`2 recipes added to ${title}`);
    await expect
      .poll(() => readCookbookMembers(aiStack, title))
      .toEqual([...names].sort((a, b) => a.localeCompare(b)));
  } finally {
    await context.close();
  }
});

test("on a cookbook page, Remove takes the selection out and leaves the cookbook standing", async ({
  browser,
  aiStack,
}) => {
  const word = token("Out");
  const names = [`${word} Ramen`, `${word} Udon`];
  const title = `${word} Noodles`;
  const ids: string[] = [];

  for (const name of names) ids.push(await seedRecipe(name));
  const cookbookId = await seedCookbook(aiStack, title, ids);
  const { context, page } = await openPage(browser, aiStack);

  try {
    await page.goto(`/cookbooks/${cookbookId}`);
    for (const name of names) await expect(card(page, name)).toBeVisible();

    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await toggle(page, names[1]!).click();
    await bar(page).getByRole("button", { name: "Remove" }).click();

    for (const name of names) await expect(card(page, name)).toBeHidden();
    await expect.poll(() => readCookbookMembers(aiStack, title)).toEqual([]);
    expect(await readCookbookTitles(aiStack)).toContain(title);
    for (const name of names) expect(await recipeExists(name)).toBe(true);
  } finally {
    await context.close();
  }
});

test("on a cookbook page, Add to cookbook copies and Delete deletes for good", async ({
  browser,
  aiStack,
}) => {
  const word = token("Both");
  const names = [`${word} Paella`, `${word} Tortilla`];
  const title = `${word} Spanish`;
  const copy = `${word} Tapas`;
  const ids: string[] = [];

  for (const name of names) ids.push(await seedRecipe(name));
  const cookbookId = await seedCookbook(aiStack, title, ids);
  const { context, page } = await openPage(browser, aiStack);

  try {
    await page.goto(`/cookbooks/${cookbookId}`);
    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await toggle(page, names[1]!).click();
    await bar(page).getByRole("button", { name: "Add to cookbook" }).click();
    await page.getByTestId("selection-new-cookbook-title").fill(copy);
    await page.getByTestId("save-selection-cookbooks").click();
    await expect
      .poll(() => readCookbookMembers(aiStack, copy))
      .toEqual([...names].sort((a, b) => a.localeCompare(b)));

    await card(page, names[0]!).click({ modifiers: ["ControlOrMeta"] });
    await bar(page).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await expect(card(page, names[0]!)).toBeHidden();
    await expect.poll(() => recipeExists(names[0]!)).toBe(false);
    expect(await readCookbookMembers(aiStack, title)).toEqual([names[1]!]);
  } finally {
    await context.close();
  }
});
