/**
 * The hand-dragged lists and the swipable rows, driven the way a reader does:
 * by a row's grip with a mouse and with a finger. Every motion `Reorder` list
 * (a recipe's ingredients and steps, the household's Stores, a Store's aisles)
 * moves a row, and a recipe card swipes open to its actions.
 *
 * Motion's drag internals change between majors without a type error, and no
 * other spec drags these rows, so this one exists to catch that.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";

import type { AIE2EStack } from "./fixture";
import { waitForRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";
import { expect, test } from "./fixture";
import { createPlainStore } from "./grocery-aisles-support";

type Pointer = "mouse" | "touch";
type Point = { x: number; y: number };

const RECIPE_NAME = "Reorder Stew";

function recipeWith(name: string) {
  return {
    name,
    description: "Rows to drag.",
    url: `https://example.com/${name.toLowerCase().replaceAll(" ", "-")}`,
    servings: 2,
    systemUsed: "metric",
    recipeIngredients: [
      { ingredientName: "Alpha", ingredientId: null, amount: 1, unit: "g", order: 0 },
      { ingredientName: "Bravo", ingredientId: null, amount: 2, unit: "g", order: 1 },
      { ingredientName: "Charlie", ingredientId: null, amount: 3, unit: "g", order: 2 },
    ],
    steps: [
      { step: "Step one alpha", order: 0, systemUsed: "metric" },
      { step: "Step two bravo", order: 1, systemUsed: "metric" },
      { step: "Step three charlie", order: 2, systemUsed: "metric" },
    ],
    tags: [],
    cuisines: [],
    categories: [],
    images: [],
    videos: [],
  };
}

/** Seeds a recipe through the mutation the recipe form uses; answers its id. */
async function seedRecipeWithRows(stack: AIE2EStack, name: string): Promise<string> {
  const recipeId = await callTrpc<string>(
    stack.baseURL,
    stack.ownerCookies,
    "recipes.create",
    recipeWith(name)
  );

  // The mutation answers before its transaction lands; wait for the rows.
  await waitForRecipe(
    stack.baseURL,
    stack.ownerCookies,
    recipeId,
    (recipe) => recipe.steps.length === 3
  );

  return recipeId;
}

/** A signed-in owner page; a finger means a phone-width touch screen. */
async function openPage(
  browser: Browser,
  stack: AIE2EStack,
  pointer: Pointer
): Promise<{ context: BrowserContext; page: Page }> {
  // Tall, so the first and the last row of a list are on screen together.
  const context = await browser.newContext({
    baseURL: stack.baseURL,
    storageState: { cookies: stack.ownerCookies, origins: [] },
    viewport: pointer === "touch" ? { width: 390, height: 1600 } : { width: 1280, height: 1600 },
    hasTouch: pointer === "touch",
  });

  return { context, page: await context.newPage() };
}

type ShownRow = { value: string; grip: Point };

/**
 * The list rows holding `values`, in the order they show, each with the centre
 * of its grip (the row's first icon). A row holds a value in one of its fields,
 * or, when it has none, in its text.
 */
async function rowsShowing(page: Page, values: string[]): Promise<ShownRow[]> {
  return page.evaluate((values) => {
    const rows: ShownRow[] = [];

    for (const li of document.querySelectorAll("li")) {
      const fields = [...li.querySelectorAll("input,textarea")].map(
        (field) => (field as HTMLInputElement).value
      );
      const value = values.find((candidate) =>
        fields.length > 0
          ? fields.some((field) => field.includes(candidate))
          : (li.textContent ?? "").includes(candidate)
      );
      const grip = li.querySelector("svg")?.getBoundingClientRect();

      if (!value || !grip) continue;
      // An outer row holding an inner one: the innermost, listed last, wins.
      const known = rows.findIndex((row) => row.value === value);
      const shown = { value, grip: { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 } };

      if (known === -1) rows.push(shown);
      else rows[known] = shown;
    }

    return rows;
  }, values);
}

/** Where `read` points once it has held still for three frames. */
async function settled(page: Page, read: () => Promise<Point | undefined>): Promise<Point> {
  let last: Point | undefined;
  let still = 0;

  await expect
    .poll(async () => {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      const at = await read();

      still = at && last && at.x === last.x && at.y === last.y ? still + 1 : 0;
      last = at;

      return still;
    })
    .toBeGreaterThanOrEqual(3);

  return last!;
}

/**
 * The grip of the row holding `value` once it has stopped moving: a list in a
 * panel slides in with it, and a press at a passing position misses the grip.
 */
async function settledGrip(page: Page, value: string): Promise<Point> {
  return settled(page, async () => (await rowsShowing(page, [value]))[0]?.grip);
}

async function orderOf(page: Page, values: string[]): Promise<string[]> {
  return (await rowsShowing(page, values)).map((row) => row.value);
}

/** A pointer that presses, moves and lets go: the mouse, or one finger. */
interface Finger {
  down(at: Point): Promise<void>;
  move(to: Point): Promise<void>;
  up(): Promise<void>;
  release(): Promise<void>;
}

async function fingerFor(page: Page, pointer: Pointer): Promise<Finger> {
  if (pointer === "mouse") {
    return {
      down: async (at) => {
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
      },
      move: (to) => page.mouse.move(to.x, to.y),
      up: () => page.mouse.up(),
      release: async () => {},
    };
  }

  // Chromium turns CDP touches into touch pointer events, as a phone sends them.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, at?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type: type as "touchStart" | "touchMove" | "touchEnd",
      touchPoints: at ? [{ x: at.x, y: at.y, id: 1 }] : [],
    });

  return {
    down: async (at) => void (await touch("touchStart", at)),
    move: async (to) => void (await touch("touchMove", to)),
    up: async () => void (await touch("touchEnd")),
    release: () => cdp.detach(),
  };
}

/**
 * Moves the pointer in small steps, a frame apart: motion reads each move
 * against the layout the last one left, so a row passes a neighbour only once
 * the list has redrawn.
 */
async function glide(page: Page, finger: Finger, from: Point, to: Point): Promise<void> {
  const steps = 12;

  for (let step = 1; step <= steps; step++) {
    await finger.move({
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }
}

/**
 * Drags the first of three rows past the other two, one at a time, and
 * expects it to land last and stay there once let go.
 */
async function expectReorder(
  page: Page,
  pointer: Pointer,
  [first, second, third]: [string, string, string]
): Promise<void> {
  const order = () => orderOf(page, [first, second, third]);

  await expect.poll(order).toEqual([first, second, third]);
  const finger = await fingerFor(page, pointer);

  try {
    let at = await settledGrip(page, first);

    await finger.down(at);
    for (const [passed, expected] of [
      [second, [second, first, third]],
      [third, [second, third, first]],
    ] as const) {
      const below = { x: at.x, y: (await rowsShowing(page, [passed]))[0]!.grip.y + 12 };

      await glide(page, finger, at, below);
      at = below;
      await expect.poll(order).toEqual(expected);
    }
    await finger.up();
  } finally {
    await finger.release();
  }
  await expect.poll(order).toEqual([second, third, first]);
}

for (const pointer of ["mouse", "touch"] as const) {
  test(`a recipe's ingredients and steps reorder with a ${pointer}`, async ({
    browser,
    aiStack,
  }) => {
    const recipeId = await seedRecipeWithRows(aiStack, `${RECIPE_NAME} ${pointer} ${Date.now()}`);
    const { context, page } = await openPage(browser, aiStack, pointer);

    try {
      await page.goto(`/recipes/edit/${recipeId}`);
      await expectReorder(page, pointer, ["Alpha", "Bravo", "Charlie"]);
      await expectReorder(page, pointer, [
        "Step one alpha",
        "Step two bravo",
        "Step three charlie",
      ]);
    } finally {
      await context.close();
    }
  });

  test(`Stores and a Store's aisles reorder with a ${pointer}`, async ({ browser, aiStack }) => {
    const stores = ["One", "Two", "Three"].map((n) => `Reorder ${pointer} ${n} ${Date.now()}`) as [
      string,
      string,
      string,
    ];

    for (const store of stores) await createPlainStore(aiStack, store);
    const { context, page } = await openPage(browser, aiStack, pointer);

    try {
      await page.goto("/groceries");
      await page.getByRole("button", { name: "View Mode" }).click();
      await page.getByRole("menuitem", { name: "Manage Stores" }).click();
      const manager = page.getByRole("dialog", { name: "Manage Stores" });

      await expect(manager.getByText(stores[2])).toBeVisible();
      // The drag takes whatever order the new Stores list in.
      const shown = (await orderOf(page, stores)) as [string, string, string];

      await expectReorder(page, pointer, shown);

      await manager
        .getByRole("listitem")
        .filter({ hasText: stores[0] })
        .getByRole("button", { name: "Edit" })
        .click();
      await expect(page.getByRole("dialog", { name: "Edit Store" })).toBeVisible();
      for (const aisle of ["Aisle A", "Aisle B", "Aisle C"]) {
        await page.getByTestId("aisle-name").fill(aisle);
        await page.getByTestId("aisle-name").press("Enter");
      }
      await expectReorder(page, pointer, ["Aisle A", "Aisle B", "Aisle C"]);
    } finally {
      await context.close();
    }
  });
}

test("a recipe card swipes open to its actions with a finger", async ({ browser, aiStack }) => {
  const name = `Swipe Stew ${Date.now()}`;

  await seedRecipeWithRows(aiStack, name);
  const { context, page } = await openPage(browser, aiStack, "touch");

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const card = page.locator("[data-recipe-card]").filter({ hasText: name });

    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    const from = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 };

    const finger = await fingerFor(page, "touch");

    try {
      await finger.down(from);
      await glide(page, finger, from, { x: from.x - 160, y: from.y });
      await finger.up();
    } finally {
      await finger.release();
    }
    // The actions sit beside the card in its swipable row, hidden until it opens.
    const action = page
      .getByRole("row")
      .filter({ has: card })
      .getByRole("button", { name: "Add to calendar" });

    // A click retried on a moving button scrolls it to the top, and a scroll closes the row.
    await settled(page, async () => (await action.boundingBox()) ?? undefined);
    await action.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } finally {
    await context.close();
  }
});
