/**
 * First-paint fidelity for Device Preferences.
 *
 * The claim under test is that a page arrives already drawn with the reader's
 * stored Device Preferences for the Device Kind the request comes from — the
 * wrong shape never paints. Choices are seeded through the real API and the
 * same page is opened as an iPhone and as a desktop.
 *
 * Where the server draws the choice itself (the groceries view, Today's
 * meals, the library layout) the assertion reads the server's markup through
 * a JavaScript-disabled page: what shows is exactly what the server sent. A
 * recipe or cookbook page draws only its skeleton on the server, so those
 * scenarios run with JavaScript and record every frame from the start, so a
 * wrong frame fails even once it is corrected.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { request } from "@playwright/test";

import type { DeviceKind } from "../harness/device-preferences";
import type { AIE2EStack } from "./fixture";
import {
  clearDevicePreferences,
  DESKTOP_USER_AGENT,
  IPHONE_USER_AGENT,
  setDevicePreferences,
} from "../harness/device-preferences";
import { databaseUrl, withDatabase } from "./database";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

let stack: AIE2EStack;

test.beforeEach(async ({ aiStack }) => {
  stack = aiStack;
  await clearDevicePreferences(databaseUrl());
});

const USER_AGENTS: Record<DeviceKind, string> = {
  phone: IPHONE_USER_AGENT,
  desktop: DESKTOP_USER_AGENT,
};

function seed(kind: DeviceKind, preferences: Record<string, unknown>): Promise<void> {
  return setDevicePreferences(stack.baseURL, stack.ownerCookies, kind, preferences);
}

/** One tRPC mutation as the owner, answering its result. */
async function callApi<T>(procedure: string, input: unknown): Promise<T> {
  const api = await request.newContext({
    baseURL: stack.baseURL,
    extraHTTPHeaders: {
      origin: stack.baseURL,
      cookie: stack.ownerCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const response = await api.post(`/api/trpc/${procedure}`, { data: { json: input } });

    if (!response.ok()) throw new Error(`${procedure} failed: ${response.status()}`);

    return ((await response.json()) as { result: { data: { json: T } } }).result.data.json;
  } finally {
    await api.dispose();
  }
}

/** A page that renders the server's bytes and nothing else, as one Device Kind. */
async function openStatic(
  browser: Browser,
  kind: DeviceKind
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    javaScriptEnabled: false,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    userAgent: USER_AGENTS[kind],
  });

  return { context, page: await context.newPage() };
}

/**
 * A live page as one Device Kind that records, from the very first frame,
 * every distinct value `selector`'s `attribute` takes (`present` when no
 * attribute is named), read back with {@link seen}.
 */
async function openWatched(
  browser: Browser,
  kind: DeviceKind,
  watch: { selector: string; attribute?: string },
  { signedIn = true }: { signedIn?: boolean } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: signedIn ? stack.ownerCookies : [], origins: [] },
    userAgent: USER_AGENTS[kind],
    serviceWorkers: "block",
  });

  await context.addInitScript(({ selector, attribute }) => {
    const values: string[] = [];

    (window as unknown as { __seen: string[] }).__seen = values;
    // The document itself: an init script runs before <html> exists.
    new MutationObserver(() => {
      const element = document.querySelector(selector);
      const value = element
        ? attribute
          ? (element.getAttribute(attribute) ?? "")
          : "present"
        : null;

      if (value !== null && values[values.length - 1] !== value) values.push(value);
    }).observe(document, { subtree: true, childList: true, attributes: true });
  }, watch);

  return { context, page: await context.newPage() };
}

function seen(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
}

// =============================================================================
// Drawn by the server
// =============================================================================

/** The groceries page's view and grouping as the server drew them for one kind. */
async function groceriesAsServed(browser: Browser, kind: DeviceKind) {
  const { context, page } = await openStatic(browser, kind);

  try {
    await page.goto("/groceries");
    const marked = page.locator("[data-grocery-view]").first();

    await expect(marked).toBeAttached();

    return {
      view: await marked.getAttribute("data-grocery-view"),
      grouping: await marked.getAttribute("data-grocery-grouping"),
    };
  } finally {
    await context.close();
  }
}

test("groceries arrives in the view and grouping stored for the phone, only on a phone", async ({
  browser,
}) => {
  await seed("phone", { groceryViewMode: "recipe", groceryGroupSimilar: false });

  expect(await groceriesAsServed(browser, "phone")).toEqual({ view: "recipe", grouping: "flat" });
  expect(await groceriesAsServed(browser, "desktop")).toEqual({
    view: "store",
    grouping: "grouped",
  });
});

test("groceries arrives in the view stored for the desktop, only on a desktop", async ({
  browser,
}) => {
  await seed("desktop", { groceryViewMode: "recipe" });

  expect(await groceriesAsServed(browser, "desktop")).toEqual({
    view: "recipe",
    grouping: "grouped",
  });
  expect(await groceriesAsServed(browser, "phone")).toEqual({ view: "store", grouping: "grouped" });
});

test("groceries arrives in the default view and grouping when nothing is stored", async ({
  browser,
}) => {
  for (const kind of ["phone", "desktop"] as const) {
    expect(await groceriesAsServed(browser, kind)).toEqual({ view: "store", grouping: "grouped" });
  }
});

/** Whether the server's dashboard carries Today's meals for one kind. */
async function dashboardHasTodaysMeals(browser: Browser, kind: DeviceKind): Promise<boolean> {
  const { context, page } = await openStatic(browser, kind);

  try {
    await page.goto("/");
    await expect(page.locator("[data-slot='tabs-tab']").first()).toBeAttached();

    return (await page.locator("#today-meals-heading").count()) > 0;
  } finally {
    await context.close();
  }
}

test("a hidden Today's meals never reaches the phone's dashboard markup, only the phone's", async ({
  browser,
}) => {
  await seed("phone", { todaysMeals: "hidden" });

  expect(await dashboardHasTodaysMeals(browser, "phone")).toBe(false);
  expect(await dashboardHasTodaysMeals(browser, "desktop")).toBe(true);
});

test("Today's meals is in the dashboard markup by default", async ({ browser }) => {
  for (const kind of ["phone", "desktop"] as const) {
    expect(await dashboardHasTodaysMeals(browser, kind)).toBe(true);
  }
});

test("a planned rule keeps the block in the dashboard markup", async ({ browser }) => {
  // What is planned is client data, so the server's share of the planned
  // rule is rendering the block; the empty-day collapse is the client's.
  await seed("desktop", { todaysMeals: "planned" });

  expect(await dashboardHasTodaysMeals(browser, "desktop")).toBe(true);
});

/** The library layout the server selected for one kind. */
async function libraryLayoutAsServed(browser: Browser, kind: DeviceKind) {
  const { context, page } = await openStatic(browser, kind);

  try {
    await page.goto("/");

    return await page
      .locator('[data-slot="tabs-tab"][aria-selected="true"]')
      .first()
      .getAttribute("data-key");
  } finally {
    await context.close();
  }
}

test("the library arrives in the list stored for the desktop, only on a desktop", async ({
  browser,
}) => {
  await seed("desktop", { recipeViewMode: "list" });

  expect(await libraryLayoutAsServed(browser, "desktop")).toBe("list");
  expect(await libraryLayoutAsServed(browser, "phone")).toBe("grid");
});

// =============================================================================
// Drawn from the first client frame
// =============================================================================

// Fractional, so the two formats are distinguishable: ½ as a fraction, 0.5
// as a decimal. Calories make the Nutrition card show.
const RECIPE = {
  name: "First Paint Porridge",
  description: "A deterministic recipe for the first-paint spec.",
  url: "https://example.com/first-paint-porridge",
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  totalMinutes: 15,
  calories: 320,
  fat: "8",
  carbs: "50",
  protein: "10",
  systemUsed: "metric",
  recipeIngredients: [
    { ingredientName: "oat milk", ingredientId: null, amount: 0.5, unit: "l", order: 0 },
    { ingredientName: "rolled oats", ingredientId: null, amount: 200, unit: "g", order: 1 },
  ],
  steps: [
    { step: "Simmer the oats in the milk.", order: 0, systemUsed: "metric" },
    { step: "Rest, then serve.", order: 1, systemUsed: "metric" },
  ],
  tags: [],
  cuisines: [],
  categories: ["Breakfast"],
  images: [],
  videos: [],
};

let recipeId: string | null = null;

/** The spec's recipe, made once, with a Dish Colour so the tint can show. */
async function ensureRecipe(): Promise<string> {
  if (recipeId) return recipeId;

  const id = await callApi<string>("recipes.create", RECIPE);

  // The mutation answers before the transaction lands; wait for the row.
  await expect
    .poll(
      () =>
        withDatabase(async (database) => {
          const result = await database.query(
            "update recipes set dish_color = '#b05a2a' where id = $1 returning id",
            [id]
          );

          return result.rowCount;
        }),
      { timeout: 30_000 }
    )
    .toBe(1);
  recipeId = id;

  return id;
}

/** The amounts a recipe page shows once loaded, as fraction or decimal. */
async function amountFormatShown(page: Page): Promise<"fraction" | "decimal"> {
  const fraction = page.getByText("½", { exact: false }).first();
  const decimal = page.getByText("0.5", { exact: false }).first();

  await expect(fraction.or(decimal)).toBeVisible({ timeout: 15_000 });

  return (await page.getByText("½", { exact: false }).count()) > 0 ? "fraction" : "decimal";
}

/** The rating and nutrition placeholders the server's recipe skeleton drew for one kind. */
async function recipeSkeletonAsServed(browser: Browser, kind: DeviceKind, id: string) {
  const { context, page } = await openStatic(browser, kind);

  try {
    await page.goto(`/recipes/${id}`);
    await expect(page.locator(".skeleton").first()).toBeAttached();

    return {
      rating: (await page.locator('[data-skeleton-part="rating"]').count()) > 0,
      nutrition: (await page.locator('[data-skeleton-part="nutrition"]').count()) > 0,
    };
  } finally {
    await context.close();
  }
}

test("a recipe skeleton leaves out the rating and nutrition hidden on the phone, only on a phone", async ({
  browser,
}) => {
  const id = await ensureRecipe();

  await seed("phone", { hiddenItems: ["rating", "nutrition"] });

  expect(await recipeSkeletonAsServed(browser, "phone", id)).toEqual({
    rating: false,
    nutrition: false,
  });
  // Nothing hidden: both placeholders.
  expect(await recipeSkeletonAsServed(browser, "desktop", id)).toEqual({
    rating: true,
    nutrition: true,
  });
});

test("groceries arrives with a by-recipe skeleton when that view is stored", async ({
  browser,
}) => {
  await seed("phone", { groceryViewMode: "recipe" });

  for (const [kind, view] of [
    ["phone", "recipe"],
    ["desktop", "store"],
  ] as const) {
    const { context, page } = await openStatic(browser, kind);

    try {
      await page.goto("/groceries");
      await expect(page.locator(`[data-grocery-skeleton="${view}"]`).first()).toBeAttached();
    } finally {
      await context.close();
    }
  }
});

test("a recipe's amounts are drawn in the format stored for the phone, only on a phone", async ({
  browser,
}) => {
  const id = await ensureRecipe();

  await seed("phone", { amountDisplay: "decimal" });

  for (const [kind, format] of [
    ["phone", "decimal"],
    ["desktop", "fraction"],
  ] as const) {
    const { context, page } = await openWatched(browser, kind, { selector: "body" });

    try {
      await page.goto(`/recipes/${id}`);
      expect(await amountFormatShown(page)).toBe(format);
    } finally {
      await context.close();
    }
  }
});

test("a Hidden Item stored for the phone is hidden only on a phone", async ({ browser }) => {
  const id = await ensureRecipe();

  await seed("phone", { hiddenItems: ["nutrition"] });

  for (const [kind, shown] of [
    ["phone", 0],
    ["desktop", 1],
  ] as const) {
    const { context, page } = await openWatched(browser, kind, { selector: "body" });

    try {
      await page.goto(`/recipes/${id}`);
      await expect(page.getByText(RECIPE.steps[0]!.step).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("h2:visible").filter({ hasText: "Nutrition" })).toHaveCount(shown);
    } finally {
      await context.close();
    }
  }
});

test("a reader who chose the theme colour on a phone never sees a tinted frame there", async ({
  browser,
}) => {
  const id = await ensureRecipe();

  await seed("phone", { recipePageColor: "theme" });

  const phone = await openWatched(browser, "phone", { selector: "[data-dish-tint]" });

  try {
    await phone.page.goto(`/recipes/${id}`);
    await expect(phone.page.getByText(RECIPE.name).first()).toBeVisible({ timeout: 15_000 });
    expect(await seen(phone.page)).toEqual([]);
  } finally {
    await phone.context.close();
  }

  // Arming check: the desktop keeps the dish's colour.
  const desktop = await openWatched(browser, "desktop", { selector: "[data-dish-tint]" });

  try {
    await desktop.page.goto(`/recipes/${id}`);
    await expect(desktop.page.locator("[data-dish-tint]")).toHaveCount(1, { timeout: 15_000 });
    expect(await seen(desktop.page)).toEqual(["present"]);
  } finally {
    await desktop.context.close();
  }
});

test("a cookbook opens in the list stored for the desktop, never as a grid first", async ({
  browser,
}) => {
  const id = await ensureRecipe();
  const cookbook = await callApi<{ id: string }>("cookbooks.create", {
    id: crypto.randomUUID(),
    title: "First Paint Cookbook",
    recipeId: id,
  });

  await seed("desktop", { recipeViewMode: "list" });

  for (const [kind, layout] of [
    ["desktop", "list"],
    ["phone", "grid"],
  ] as const) {
    const { context, page } = await openWatched(browser, kind, {
      selector: '[data-slot="tabs-tab"][aria-selected="true"]',
      attribute: "data-key",
    });

    try {
      await page.goto(`/cookbooks/${cookbook.id}`);
      await expect(page.getByText(RECIPE.name).first()).toBeVisible({ timeout: 15_000 });
      expect(await seen(page)).toEqual([layout]);
    } finally {
      await context.close();
    }
  }
});

test("a shared recipe shows a signed-in reader their own format and a signed-out one the default", async ({
  browser,
}) => {
  const id = await ensureRecipe();
  const share = await callApi<{ url: string }>("recipes.shareCreate", { recipeId: id });

  await seed("phone", { amountDisplay: "decimal" });

  const signedIn = await openWatched(browser, "phone", { selector: "body" });

  try {
    await signedIn.page.goto(share.url);
    expect(await amountFormatShown(signedIn.page)).toBe("decimal");
  } finally {
    await signedIn.context.close();
  }

  const signedOut = await openWatched(browser, "phone", { selector: "body" }, { signedIn: false });

  try {
    await signedOut.page.goto(share.url);
    expect(await amountFormatShown(signedOut.page)).toBe("fraction");

    // The switch works for the visit…
    await signedOut.page
      .getByRole("button", { name: /show decimals/i })
      .first()
      .click();
    await expect(signedOut.page.getByText("½", { exact: false })).toHaveCount(0);

    // …and is not remembered.
    await signedOut.page.reload();
    expect(await amountFormatShown(signedOut.page)).toBe("fraction");
  } finally {
    await signedOut.context.close();
  }
});
