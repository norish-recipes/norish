/**
 * First-paint fidelity for Device Preferences.
 *
 * The claim under test is that a page arrives already drawn with the reader's
 * stored Device Preferences for the Device Kind the request comes from — the
 * wrong shape never paints. Choices are seeded through the real API and the
 * same page is opened as an iPhone and as a desktop.
 *
 * Where the server draws the choice itself (the groceries view, Today's
 * meals, the library layout, the calendar's phone or desktop layout) the
 * assertion reads the server's markup through
 * a JavaScript-disabled page: what shows is exactly what the server sent, the
 * skeletons included. A full load of a page whose data the address names (a
 * recipe, a shared recipe, a cookbook, the groceries) also carries that data,
 * which may stream in behind the skeleton for JavaScript to swap in. So the
 * scenarios about what a page shows run with JavaScript; where a wrong frame
 * could paint and be corrected, they record every frame from the start.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";

import { updateRecipeDishColor } from "@norish/db/repositories/recipes";

import type { DeviceKind } from "../harness/device-preferences";
import type { AIE2EStack } from "./fixture";
import { RECIPE_FILTERS_COOKIE } from "../../../lib/recipe-filters-cookie";
import {
  clearDevicePreferences,
  DESKTOP_USER_AGENT,
  IPHONE_USER_AGENT,
  setDevicePreferences,
} from "../harness/device-preferences";
import { readRecipe, waitForRecipe } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect, OWNER, test } from "./fixture";

test.describe.configure({ mode: "serial" });

let stack: AIE2EStack;

test.beforeEach(async ({ aiStack }) => {
  stack = aiStack;
  await clearDevicePreferences();
});

const USER_AGENTS: Record<DeviceKind, string> = {
  phone: IPHONE_USER_AGENT,
  desktop: DESKTOP_USER_AGENT,
};

function seed(kind: DeviceKind, preferences: Record<string, unknown>): Promise<void> {
  return setDevicePreferences(stack.baseURL, stack.ownerCookies, kind, preferences);
}

/** One tRPC mutation as the owner, answering its result. */
function callApi<T>(procedure: string, input: unknown): Promise<T> {
  return callTrpc<T>(stack.baseURL, stack.ownerCookies, procedure, input);
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
 * A live page as one Device Kind. With `watch` it records, from the very first
 * frame, every distinct value `selector`'s `attribute` takes (`present` when
 * no attribute is named), read back with {@link seen}.
 */
async function openLive(
  browser: Browser,
  kind: DeviceKind,
  {
    watch,
    signedIn = true,
    viewport,
  }: {
    watch?: { selector: string; attribute?: string };
    signedIn?: boolean;
    viewport?: { width: number; height: number };
  } = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: signedIn ? stack.ownerCookies : [], origins: [] },
    userAgent: USER_AGENTS[kind],
    serviceWorkers: "block",
    ...(viewport && { viewport }),
  });

  if (!watch) return { context, page: await context.newPage() };

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
  await seed("phone", { todaySectionVisibility: "hidden" });

  expect(await dashboardHasTodaysMeals(browser, "phone")).toBe(false);
  expect(await dashboardHasTodaysMeals(browser, "desktop")).toBe(true);
});

test("Today's meals is in the dashboard markup by default", async ({ browser }) => {
  for (const kind of ["phone", "desktop"] as const) {
    expect(await dashboardHasTodaysMeals(browser, kind)).toBe(true);
  }
});

/** `YYYY-MM-DD` for today in `timeZone`. */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

test("a full load of the dashboard draws Today's meals for the reader's day, from their time zone", async ({
  browser,
}) => {
  // A zone on another date than the server's, so only the cookie can name the day, and no other
  // scenario's plans for the server's today share it. UTC+14 and UTC-11 are never on one date.
  const serverToday = new Date().toLocaleDateString("en-CA");
  const timeZone = ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find(
    (zone) => todayIn(zone) !== serverToday
  )!;
  const today = todayIn(timeZone);

  await seed("desktop", { todaySectionVisibility: "planned" });
  await callApi("calendar.createItem", {
    id: crypto.randomUUID(),
    date: today,
    slot: "Dinner",
    itemType: "note",
    title: "Served time-zone note",
  });
  const { context, page } = await openStatic(browser, "desktop");

  try {
    await context.addCookies([{ name: "norish-tz", value: timeZone, url: stack.baseURL }]);
    await page.goto("/");
    // Planned, so drawn at all only because the server knew what was planned that day.
    await expect(page.getByText("Served time-zone note").first()).toBeAttached();
    // Without JavaScript the route's skeleton stays above the streamed page, so the page's is last.
    await expect(
      page.locator('section[aria-labelledby="today-meals-heading"]').last()
    ).toContainText(
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone,
      }).format(new Date())
    );
  } finally {
    await context.close();
  }
});

test("a full load of the calendar carries its opening range, so its days draw without asking", async ({
  browser,
}) => {
  await callApi("calendar.createItem", {
    id: crypto.randomUUID(),
    date: new Date().toLocaleDateString("en-CA"),
    slot: "Lunch",
    itemType: "note",
    title: "Served calendar note",
  });
  const { context, page } = await openLive(browser, "phone");
  const asked: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("calendar.listItems")) asked.push(request.url());
  });

  try {
    await page.goto("/calendar");
    await expect(page.getByText("Served calendar note").first()).toBeVisible();
    expect(asked).toEqual([]);
  } finally {
    await context.close();
  }
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

test("the calendar arrives in the layout of the Device Kind, not the server's window guess", async ({
  browser,
}) => {
  for (const [kind, other] of [
    ["phone", "desktop"],
    ["desktop", "phone"],
  ] as const) {
    const { context, page } = await openStatic(browser, kind);

    try {
      await page.goto("/calendar");
      await expect(page.locator(`[data-calendar-skeleton="${kind}"]`).first()).toBeAttached();
      await expect(page.locator(`[data-calendar-skeleton="${other}"]`)).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
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

  await waitForRecipe(stack.baseURL, stack.ownerCookies, id);
  // A Dish Colour is derived from media, so no editor sets one; the repository does.
  await updateRecipeDishColor(id, "#b05a2a");
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

test("a full load of a recipe page carries the recipe in the server's markup", async ({
  browser,
}) => {
  const id = await ensureRecipe();
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto(`/recipes/${id}`);
    // Elements, not the dehydrated data in the page's scripts.
    await expect(page.locator("h1, h2").filter({ hasText: RECIPE.name }).first()).toBeAttached();
    await expect(page.getByText(RECIPE.steps[0]!.step).first()).toBeAttached();
  } finally {
    await context.close();
  }
});

test("a full load of a shared recipe carries the recipe in the server's markup", async ({
  browser,
}) => {
  const id = await ensureRecipe();
  const share = await callApi<{ url: string }>("recipes.shareCreate", { recipeId: id });
  // Signed out, as a shared link is mostly read.
  const context = await browser.newContext({ baseURL: stack.baseURL, javaScriptEnabled: false });

  try {
    const page = await context.newPage();

    await page.goto(share.url);
    await expect(page.locator("h1, h2").filter({ hasText: RECIPE.name }).first()).toBeAttached();
  } finally {
    await context.close();
  }
});

test("a full load of a cookbook carries the cookbook in the server's markup", async ({
  browser,
}) => {
  const cookbook = await callApi<{ id: string }>("cookbooks.create", {
    id: crypto.randomUUID(),
    title: "Served Cookbook",
    recipeId: await ensureRecipe(),
  });
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto(`/cookbooks/${cookbook.id}`);
    await expect(page.getByText("Served Cookbook").first()).toBeAttached();
  } finally {
    await context.close();
  }
});

test("a full load of groceries or the Pantry carries the list in the server's markup", async ({
  browser,
}) => {
  await callApi("groceries.create", [
    { id: crypto.randomUUID(), name: "served oat milk", unit: null, amount: null },
  ]);
  await callApi("pantry.add", { id: crypto.randomUUID(), name: "honey" });
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto("/groceries");
    await expect(page.locator('[data-grocery-name="served oat milk"]').first()).toBeAttached();
    await page.goto("/groceries/pantry");
    await expect(page.locator("[data-pantry-ingredient]").first()).toBeAttached();
  } finally {
    await context.close();
  }
});

test("groceries opened in the app waits on a by-recipe skeleton when that view is stored", async ({
  browser,
}) => {
  await seed("phone", { groceryViewMode: "recipe" });

  for (const [kind, view] of [
    ["phone", "recipe"],
    ["desktop", "store"],
  ] as const) {
    const { context, page } = await openLive(browser, kind);

    try {
      // A full load carries the list; an in-app visit waits for it, here for good.
      await page.route(
        (url) => url.pathname.includes("groceries.list"),
        () => {}
      );
      await page.goto("/");
      await page.getByRole("link", { name: "Groceries", exact: true }).first().click();
      await expect(page.locator(`[data-grocery-skeleton="${view}"]`).first()).toBeAttached();
    } finally {
      await context.close();
    }
  }
});

test("the library draws phone columns on an iPhone from its first frame", async ({ browser }) => {
  await ensureRecipe();

  const { context, page } = await openLive(browser, "phone", {
    watch: { selector: '[data-index="0"] > .grid', attribute: "style" },
    viewport: { width: 390, height: 844 },
  });

  try {
    await page.goto("/");
    await expect(page.getByText(RECIPE.name).first()).toBeVisible({ timeout: 15_000 });
    expect(await seen(page)).toEqual([expect.stringContaining("repeat(2,")]);
  } finally {
    await context.close();
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
    const { context, page } = await openLive(browser, kind);

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
    const { context, page } = await openLive(browser, kind);

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

  const phone = await openLive(browser, "phone", { watch: { selector: "[data-dish-tint]" } });

  try {
    await phone.page.goto(`/recipes/${id}`);
    await expect(phone.page.getByText(RECIPE.name).first()).toBeVisible({ timeout: 15_000 });
    expect(await seen(phone.page)).toEqual([]);
  } finally {
    await phone.context.close();
  }

  // Arming check: the desktop keeps the dish's colour.
  const desktop = await openLive(browser, "desktop", { watch: { selector: "[data-dish-tint]" } });

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
    const { context, page } = await openLive(browser, kind, {
      watch: { selector: '[data-slot="tabs-tab"][aria-selected="true"]', attribute: "data-key" },
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

  const signedIn = await openLive(browser, "phone");

  try {
    await signedIn.page.goto(share.url);
    expect(await amountFormatShown(signedIn.page)).toBe("decimal");
  } finally {
    await signedIn.context.close();
  }

  const signedOut = await openLive(browser, "phone", { signedIn: false });

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

// =============================================================================
// The reader, the pages' extras and the Library, in the server's markup
// =============================================================================

// Specs in a worker share one database; what these scenarios make goes when they are done, so
// a spec that counts recipes or prices a list after them sees only its own.
const created = { recipes: [] as string[], cookbooks: [] as string[], stores: [] as string[] };

test.afterAll(async () => {
  const { groceries } = await callTrpc<{
    groceries: Array<{ id: string; version: number; storeId: string | null }>;
  }>(stack.baseURL, stack.ownerCookies, "groceries.list");
  const stores = await callTrpc<Array<{ id: string; version: number }>>(
    stack.baseURL,
    stack.ownerCookies,
    "stores.list"
  );

  for (const store of stores.filter(({ id }) => created.stores.includes(id))) {
    await callApi("stores.delete", {
      storeId: store.id,
      version: store.version,
      deleteGroceries: true,
      grocerySnapshot: groceries
        .filter((grocery) => grocery.storeId === store.id)
        .map(({ id, version }) => ({ id, version })),
    });
  }
  for (const id of created.cookbooks) {
    const { version } = await queryTrpc<{ version: number }>(
      stack.baseURL,
      stack.ownerCookies,
      "cookbooks.get",
      { id }
    );

    await callApi("cookbooks.remove", { id, version });
  }
  for (const id of created.recipes) {
    const recipe = await readRecipe(stack.baseURL, stack.ownerCookies, id);

    if (recipe) await callApi("recipes.delete", { id, version: recipe.version });
  }
  // Store and recipe deletes land after their mutations answer.
  await expect
    .poll(async () => {
      const left = await callTrpc<Array<{ id: string }>>(
        stack.baseURL,
        stack.ownerCookies,
        "stores.list"
      );
      const recipes = await Promise.all(
        created.recipes.map((id) => readRecipe(stack.baseURL, stack.ownerCookies, id))
      );

      return left.some(({ id }) => created.stores.includes(id)) || recipes.some(Boolean);
    })
    .toBe(false);
});

/** The Library filters cookie a browser writes, set before a full load. */
async function storeFiltersCookie(context: BrowserContext, filters: Record<string, unknown>) {
  await context.addCookies([
    {
      name: RECIPE_FILTERS_COOKIE,
      value: encodeURIComponent(JSON.stringify(filters)),
      url: stack.baseURL,
    },
  ]);
}

/** A recipe made for one scenario, so its name is the spec's own. */
async function createRecipe(name: string, category = "Breakfast"): Promise<string> {
  const id = await callApi<string>("recipes.create", {
    ...RECIPE,
    name,
    url: `https://example.com/${encodeURIComponent(name)}`,
    categories: [category],
  });

  await waitForRecipe(stack.baseURL, stack.ownerCookies, id);
  created.recipes.push(id);

  return id;
}

test("a full load carries the reader, so the navbar avatar is in the server's markup", async ({
  browser,
}) => {
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto("/");
    await expect(
      page.locator(`button[aria-label="Open user menu"] [role="img"][aria-label="${OWNER.name}"]`)
    ).not.toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("a recipe's actions offer editing before the session or the permissions answer", async ({
  browser,
}) => {
  const id = await ensureRecipe();
  const { context, page } = await openLive(browser, "phone");

  try {
    // Never answered: only what the document carried can make the reader an editor.
    await page.route(
      (url) =>
        url.pathname.startsWith("/api/auth/get-session") ||
        url.pathname.includes("permissions.get"),
      () => {}
    );
    await page.goto(`/recipes/${id}`);
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("a full load of a recipe carries its rating in the server's markup", async ({ browser }) => {
  const id = await ensureRecipe();

  await callApi("ratings.rate", { recipeId: id, rating: 4 });
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto(`/recipes/${id}`);
    // The fourth star filled and the fifth not: the reader's own rating, not a placeholder.
    await expect(
      page.locator('button[aria-label="Rate 4 out of 5"]:not([disabled]) .text-warning').first()
    ).toBeAttached();
    await expect(page.locator('button[aria-label="Rate 5 out of 5"] .text-warning')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("a full load of groceries carries a grocery's price and its aisle in the server's markup", async ({
  browser,
}) => {
  const storeId = crypto.randomUUID();
  const aisleId = crypto.randomUUID();
  const name = "fennel";

  created.stores.push(storeId);

  await callApi("stores.create", {
    id: storeId,
    name: "First Paint Market",
    color: "primary",
    aisles: [{ id: aisleId, name: "First Paint Produce" }],
  });
  await callApi("groceries.create", [
    { id: crypto.randomUUID(), name, unit: null, amount: null, storeId },
  ]);
  await callApi("stores.chooseProduct", {
    storeId,
    name,
    choice: {
      kind: "manual",
      id: crypto.randomUUID(),
      name: "Fresh fennel",
      price: 1.79,
      currency: "EUR",
    },
  });
  await callApi("stores.fileGroceryName", { storeId, name, aisleId });
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto("/groceries");
    await expect(
      page.locator(`[data-grocery-name="${name}"] [data-testid="grocery-price"]`).first()
    ).toContainText("1.79");
    await expect(
      page.locator('[data-aisle-name="First Paint Produce"][data-aisle-empty="false"]').first()
    ).toBeAttached();
  } finally {
    await context.close();
  }
});

test("the Library arrives under the filters the browser stored, and hydrates without a mismatch", async ({
  browser,
}) => {
  await createRecipe("Aardvark First Paint Stew");
  const { context, page } = await openLive(browser, "phone");

  try {
    // Title order puts the scenario's recipe first; the default, newest first, would not.
    await storeFiltersCookie(context, { sortMode: "titleAsc" });
    await createRecipe("Zebra First Paint Pie");
    // The first card the server sent. Hydration keeps the server's elements; a mismatch, which a
    // production build doesn't report, makes React draw new ones.
    await context.addInitScript(() => {
      new MutationObserver((_, observer) => {
        const card = document.querySelector('[data-recipe-card][role="button"]');

        if (!card) return;
        (window as unknown as { __served: Element }).__served = card;
        observer.disconnect();
      }).observe(document, { subtree: true, childList: true });
    });
    await page.goto("/");
    const first = page.locator('[data-recipe-card][role="button"]:visible').first();

    await expect(first).toContainText("Aardvark First Paint Stew");
    expect(
      await page.evaluate(() => (window as unknown as { __served?: Element }).__served?.isConnected)
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("a full load of the Library draws its cards in the server's markup", async ({ browser }) => {
  await createRecipe("Served Library Soup");
  const { context, page } = await openStatic(browser, "phone");

  try {
    await storeFiltersCookie(context, {});
    await page.goto("/");
    await expect(
      page.locator('[data-recipe-card][role="button"]').filter({ hasText: "Served Library Soup" })
    ).not.toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("a reader who scrolls the Library before it hydrates meets no blank rows", async ({
  browser,
}) => {
  for (let index = 0; index < 12; index++) await createRecipe(`Scrolled Early ${index}`);
  const { context, page } = await openLive(browser, "phone", {
    viewport: { width: 390, height: 844 },
  });

  try {
    await storeFiltersCookie(context, {});
    // No app script ever runs: the page stays as the server drew it, its streamed parts swapped in.
    await page.route(
      (url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"),
      (route) => route.abort()
    );
    await page.goto("/", { waitUntil: "commit" });
    await page.locator('[data-recipe-card][role="button"]').first().waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(() => {
      const list = document.querySelector('[data-index="0"]')!.parentElement!;
      const rows = [...list.children].map((row) => row.getBoundingClientRect().bottom);

      return list.getBoundingClientRect().bottom - Math.max(...rows);
    });

    expect(gap).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});

test("a cookbook opened under stored filters asks for its members once and never shows one they leave out", async ({
  browser,
}) => {
  const dinner = await createRecipe("Filtered Dinner Member", "Dinner");
  const breakfast = await createRecipe("Filtered Breakfast Member", "Breakfast");
  const cookbook = await callApi<{ id: string }>("cookbooks.create", {
    id: crypto.randomUUID(),
    title: "Filtered Cookbook",
    recipeId: dinner,
  });

  created.cookbooks.push(cookbook.id);

  await callApi("cookbooks.setMembership", {
    cookbookId: cookbook.id,
    recipeId: breakfast,
    isMember: true,
  });
  const { context, page } = await openLive(browser, "phone");
  const asked: string[] = [];

  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());

    if (url.includes("cookbooks.recipes") && url.includes(cookbook.id)) asked.push(url);
  });

  try {
    // Stored the way the browser keeps them without the cookie: localStorage only, read after
    // mount, so the page has to wait for them.
    await context.addInitScript(() => {
      // The Cache Warmer runs only in the tab holding the leader lock; held here, it never asks
      // for the members, so every request left is the page's own.
      void navigator.locks.request("norish-outbox-replay", () => new Promise(() => {}));
      localStorage.setItem(
        "norish:recipe-filters",
        JSON.stringify({ sortMode: "dateDesc", filterMode: "AND", categories: ["Dinner"] })
      );
      const seen = { breakfast: false };

      (window as unknown as { __seen: typeof seen }).__seen = seen;
      // Cards only: the page's data scripts name every member.
      new MutationObserver(() => {
        const cards = document.querySelectorAll('[data-recipe-card][role="button"]');

        if ([...cards].some((card) => card.textContent?.includes("Filtered Breakfast Member"))) {
          seen.breakfast = true;
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto(`/cookbooks/${cookbook.id}`);
    await expect(page.getByText("Filtered Dinner Member").first()).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __seen: { breakfast: boolean } }).__seen)
    ).toEqual({ breakfast: false });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('"categories":["Dinner"]');
  } finally {
    await context.close();
  }
});

test("a full load of a cookbook draws its members in the server's markup", async ({ browser }) => {
  const id = await createRecipe("Served Cookbook Member");
  const cookbook = await callApi<{ id: string }>("cookbooks.create", {
    id: crypto.randomUUID(),
    title: "Served Members",
    recipeId: id,
  });

  created.cookbooks.push(cookbook.id);
  const { context, page } = await openStatic(browser, "phone");

  try {
    await storeFiltersCookie(context, {});
    await page.goto(`/cookbooks/${cookbook.id}`);
    await expect(
      page
        .locator('[data-recipe-card][role="button"]')
        .filter({ hasText: "Served Cookbook Member" })
    ).not.toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("a full load of the user settings tab draws the reader's name in its field", async ({
  browser,
}) => {
  const { context, page } = await openStatic(browser, "phone");

  try {
    await page.goto("/settings?tab=user");
    await expect(page.locator(`input[value="${OWNER.name}"]`).first()).toBeAttached();
  } finally {
    await context.close();
  }
});

test("the user settings tab draws a date the way the server sent it, in any browser language and zone", async ({
  browser,
}) => {
  const id = await createRecipe("Dated Share Recipe");

  await callApi("recipes.shareCreate", { recipeId: id });
  // CSS, not roles: without JavaScript the streamed tab stays in a hidden container.
  const created = (page: Page) =>
    page.locator("tr", { hasText: "Dated Share Recipe" }).locator('td[data-key$=":created"]');
  const served = await openStatic(browser, "phone");
  const live = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    userAgent: USER_AGENTS.phone,
    serviceWorkers: "block",
    // Neither the server's language nor its zone: a date the browser formats itself would differ.
    locale: "nl-NL",
    timezoneId: "Pacific/Kiritimati",
  });

  try {
    await served.page.goto("/settings?tab=user");
    const page = await live.newPage();

    await page.goto("/settings?tab=user");
    // A production build reports no mismatch; a hydrated date that differs from the served one is it.
    await expect(created(page)).toHaveText((await created(served.page).textContent()) ?? "");
  } finally {
    await served.context.close();
    await live.close();
  }
});

test("a full load of the Library never asks for its first page: the document carries it", async ({
  browser,
}) => {
  await ensureRecipe();
  const { context, page } = await openLive(browser, "phone");
  const asked: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("library.list")) asked.push(request.url());
  });

  try {
    await storeFiltersCookie(context, {});
    // The Cache Warmer reads the Library too; held off here, every request left is the page's own.
    await context.addInitScript(() => {
      void navigator.locks.request("norish-outbox-replay", () => new Promise(() => {}));
    });
    // Returns once every card has hydrated, after the app's providers above them asked for data.
    await page.goto("/");
    await expect(page.locator('[data-recipe-card][role="button"]').first()).toBeVisible();
    expect(asked).toEqual([]);
  } finally {
    await context.close();
  }
});

test("a page the installed app's worker fetches itself still carries its recipe", async ({
  browser,
}) => {
  const id = await ensureRecipe();
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    userAgent: USER_AGENTS.phone,
    serviceWorkers: "allow",
  });

  try {
    const page = await context.newPage();

    await page.goto(`/recipes/${id}`);
    // Without navigation preload the worker fetches the document itself, which the browser sends
    // as `Sec-Fetch-Dest: empty`.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;

      while (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await registration.navigationPreload.disable();
    });
    const response = await page.reload();

    expect(response?.fromServiceWorker()).toBe(true);
    expect(await response!.text()).toContain(RECIPE.name);
  } finally {
    await context.close();
  }
});
