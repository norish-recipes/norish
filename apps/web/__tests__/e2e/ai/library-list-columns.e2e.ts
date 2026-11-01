/**
 * The Library's list view in columns.
 *
 * The list keeps its compact rows but lays them side by side as the window
 * widens: one column on a phone, two from Tailwind's `lg`, three from `xl`.
 * What only a browser can settle is the layout itself — rows that really sit
 * next to each other, the server's first frame already in the right number of
 * columns, a long title wrapping inside its row rather than being cut off, and
 * a fully populated row keeping every fact and its allergen warning in view.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";

import type { DeviceKind } from "../harness/device-preferences";
import type { AIE2EStack } from "./fixture";
import {
  clearDevicePreferences,
  DESKTOP_USER_AGENT,
  IPHONE_USER_AGENT,
  setDevicePreferences,
} from "../harness/device-preferences";
import { createRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const LONG_TITLE = "Slow-Roasted Tomato and Garlic Soup with Basil Oil";
const NAMES = [
  "Column Pancakes",
  "Column Greek Salad",
  "Column Lentil Soup",
  "Column Banana Bread",
  "Column Fried Rice",
  LONG_TITLE,
];

const USER_AGENTS: Record<DeviceKind, string> = {
  phone: IPHONE_USER_AGENT,
  desktop: DESKTOP_USER_AGENT,
};

let stack: AIE2EStack;

test.beforeAll(async ({ aiStack }) => {
  stack = aiStack;
  // Created oldest first, so the long title is the newest and leads the list.
  for (const name of NAMES) {
    await createRecipe(stack.baseURL, stack.ownerCookies, name, [], {
      totalMinutes: 30,
      tags: [{ name: "vegetarian" }, { name: "weekend" }, { name: "family" }],
    });
  }
});

test.beforeEach(async () => {
  await clearDevicePreferences();
  await setDevicePreferences(stack.baseURL, stack.ownerCookies, "desktop", {
    recipeViewMode: "list",
  });
  await setDevicePreferences(stack.baseURL, stack.ownerCookies, "phone", {
    recipeViewMode: "list",
  });
});

test.afterAll(async () => {
  await clearDevicePreferences();
});

/**
 * The Library as one Device Kind in a window of `width`, recording from the
 * very first frame every distinct column template the first list row takes.
 */
async function openLibrary(
  browser: Browser,
  kind: DeviceKind,
  width: number
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    userAgent: USER_AGENTS[kind],
    serviceWorkers: "block",
    viewport: { width, height: 900 },
  });

  await context.addInitScript(() => {
    const values: string[] = [];

    (window as unknown as { __columns: string[] }).__columns = values;
    new MutationObserver(() => {
      const row = document.querySelector<HTMLElement>('[data-index="0"] > .grid');
      const value = row?.style.gridTemplateColumns;

      if (value && values[values.length - 1] !== value) values.push(value);
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });

  const page = await context.newPage();

  await page.goto("/");
  await expect(page.locator("[data-recipe-card] h3", { hasText: LONG_TITLE })).toBeVisible({
    timeout: 15_000,
  });

  return { context, page };
}

function columnsSeen(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __columns: string[] }).__columns);
}

/** The top edge of the first `count` list rows, in the list's order. */
function rowTops(page: Page, count: number): Promise<number[]> {
  return page.evaluate(
    (n) =>
      [...document.querySelectorAll("[data-index] [data-recipe-card]")]
        .slice(0, n)
        .map((card) => Math.round(card.getBoundingClientRect().top)),
    count
  );
}

test("a wide desktop lays the list out three to a row from the first frame", async ({
  browser,
}) => {
  const { context, page } = await openLibrary(browser, "desktop", 1440);

  try {
    expect(await columnsSeen(page)).toEqual([expect.stringContaining("repeat(3,")]);

    const [first, second, third, fourth] = await rowTops(page, 4);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(fourth).toBeGreaterThan(first!);
  } finally {
    await context.close();
  }
});

test("a narrower desktop lays the list out two to a row", async ({ browser }) => {
  const { context, page } = await openLibrary(browser, "desktop", 1100);

  try {
    // The server draws the desktop's usual window (three columns); the browser then measures
    // its own and settles on two.
    await expect.poll(async () => (await columnsSeen(page)).at(-1)).toContain("repeat(2,");

    const [first, second, third] = await rowTops(page, 3);

    expect(second).toBe(first);
    expect(third).toBeGreaterThan(first!);
  } finally {
    await context.close();
  }
});

test("a phone keeps the list to one column", async ({ browser }) => {
  const { context, page } = await openLibrary(browser, "phone", 390);

  try {
    expect(await columnsSeen(page)).toEqual([expect.stringContaining("repeat(1,")]);

    const [first, second] = await rowTops(page, 2);

    expect(second).toBeGreaterThan(first!);
  } finally {
    await context.close();
  }
});

test("a long title wraps onto a second line inside its row", async ({ browser }) => {
  const { context, page } = await openLibrary(browser, "desktop", 1440);

  try {
    const layout = await page.evaluate((title) => {
      const heading = [...document.querySelectorAll<HTMLElement>("[data-recipe-card] h3")].find(
        (candidate) => candidate.title === title
      );
      const card = heading?.closest<HTMLElement>("[data-recipe-card]");

      if (!heading || !card) return null;

      const lineHeight = parseFloat(getComputedStyle(heading).lineHeight);
      const cardBox = card.getBoundingClientRect();
      const lowest = Math.max(
        ...[...card.querySelectorAll<HTMLElement>("[data-recipe-card] *")].map(
          (element) => element.getBoundingClientRect().bottom
        )
      );

      return {
        lines: Math.round(heading.clientHeight / lineHeight),
        cut: heading.scrollHeight > heading.clientHeight + 1,
        insideCard: lowest <= cardBox.bottom + 0.5,
      };
    }, LONG_TITLE);

    expect(layout).toEqual({ lines: 2, cut: false, insideCard: true });
  } finally {
    await context.close();
  }
});

/** Every chip of the row titled `title`, and whether any of them falls outside the row. */
function rowChips(page: Page, title: string) {
  return page.evaluate((wanted) => {
    const heading = [
      ...document.querySelectorAll<HTMLElement>("[data-recipe-card] h3, [data-cookbook-card] h3"),
    ].find((candidate) => candidate.title === wanted);
    const content = heading?.closest<HTMLElement>(".flex-col");
    // The facts sit in a `display: contents` group, so the row is that group's parent.
    let chips = content?.querySelector<HTMLElement>(".chip")?.parentElement ?? null;

    if (chips && getComputedStyle(chips).display === "contents") chips = chips.parentElement;
    if (!content || !chips) return null;

    const box = content.getBoundingClientRect();
    const bottom = box.bottom - parseFloat(getComputedStyle(content).paddingBottom) + 0.5;
    const row = chips.getBoundingClientRect();
    const items = [...chips.querySelectorAll<HTMLElement>(".chip")];

    return {
      texts: items.map((item) => item.textContent?.trim() ?? ""),
      warnings: items.filter((item) => item.dataset.color === "warning").length,
      allInView: items.every((item) => {
        const r = item.getBoundingClientRect();

        return r.right <= row.right + 0.5 && r.bottom <= Math.min(row.bottom, bottom) + 0.5;
      }),
    };
  }, title);
}

test("a fully populated row keeps every fact and its allergen warning in view", async ({
  browser,
}) => {
  const recipeTitle = "Baked Mac and Cheese with Crispy Breadcrumbs";
  const cookbookTitle = "Comfort Food for Busy Weeknights";
  const { allergies, version } = await callTrpc<{ allergies: string[]; version: number }>(
    stack.baseURL,
    stack.ownerCookies,
    "user.getAllergies"
  );
  const recipeId = await createRecipe(stack.baseURL, stack.ownerCookies, recipeTitle, [], {
    servings: 12,
    totalMinutes: 95,
    tags: [{ name: "Gluten" }, { name: "Lactose" }, { name: "comfort food classics" }],
  });

  await callTrpc(stack.baseURL, stack.ownerCookies, "ratings.rate", { recipeId, rating: 5 });
  await callTrpc(stack.baseURL, stack.ownerCookies, "cookbooks.create", {
    id: crypto.randomUUID(),
    title: cookbookTitle,
    recipeId,
  });
  await callTrpc(stack.baseURL, stack.ownerCookies, "user.setAllergies", {
    allergies: ["gluten", "lactose"],
    version,
  });

  try {
    for (const [kind, width] of [
      ["phone", 390],
      ["desktop", 1440],
    ] as const) {
      const { context, page } = await openLibrary(browser, kind, width);

      try {
        // Rating, time and servings, one tag and the count of the rest, the allergen first.
        await expect
          .poll(() => rowChips(page, recipeTitle))
          .toEqual({
            texts: ["5", "1:35h", "12", "Gluten", "+2"],
            warnings: 2,
            allInView: true,
          });
        await expect.poll(async () => (await rowChips(page, cookbookTitle))?.allInView).toBe(true);
        expect((await rowChips(page, cookbookTitle))?.warnings).toBeGreaterThan(0);
      } finally {
        await context.close();
      }
    }
  } finally {
    const current = await callTrpc<{ version: number }>(
      stack.baseURL,
      stack.ownerCookies,
      "user.getAllergies"
    );

    await callTrpc(stack.baseURL, stack.ownerCookies, "user.setAllergies", {
      allergies,
      version: current.version,
    });
  }
});
